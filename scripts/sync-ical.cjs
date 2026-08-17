#!/usr/bin/env node
/**
 * MANA iCal Sync Script (CommonJS version)
 * Fetches Jane iCal feed, parses appointments, upserts into Supabase.
 *
 * Usage: node scripts/sync-ical.cjs
 * Env vars: JANE_ICAL_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

const ical = require('node-ical');
const { createClient } = require('@supabase/supabase-js');
const manaKeys = require('./mana-keys.cjs');

const ICAL_URL = process.env.JANE_ICAL_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// PHI policy: Supabase stores ONLY opaque codes (patient_code). Real identities live in the
// encrypted key file (mana-keys.cjs). patient_name is NOT written for new rows; raw_summary
// is scrubbed to replace the patient name with the code.
const keyStore = manaKeys.loadKeys();
let keysDirty = false;

if (!ICAL_URL) {
  console.error('ERROR: JANE_ICAL_URL not set');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sync() {
  console.log(`[${new Date().toISOString()}] Syncing iCal feed...`);

  let events;
  try {
    events = await ical.async.fromURL(ICAL_URL);
  } catch (err) {
    console.error(`Failed to fetch iCal: ${err.message}`);
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;

  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;

    const summary = event.summary || '';
    const start = event.start ? new Date(event.start) : null;
    const end = event.end ? new Date(event.end) : null;

    if (!start) continue;

    const appointmentDate = start.toISOString().split('T')[0];
    const appointmentTime = start.toTimeString().slice(0, 5);
    const durationMinutes = end ? Math.round((end - start) / 60000) : 60;
    const isCancelled = summary.toLowerCase().includes('cancelled') || event.status === 'CANCELLED';
    const status = isCancelled ? 'cancelled' : 'confirmed';

    // Extract patient name and type from summary
    // Jane formats:
    //   "Break - " → break without patient
    //   "Charlotte M. (Follow-Up Visit)" → name in parens
    //   "Bryant Shin S. (Training Session)"
    let patientName = summary;
    let appointmentType = '';

    // Format 1: "Name (Type)" — most common in Jane
    const parenMatch = summary.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (parenMatch) {
      patientName = parenMatch[1].trim();
      appointmentType = parenMatch[2].trim();
    } else {
      // Format 2: "Type - Name" (fallback)
      const dashMatch = summary.match(/^(.+?)\s*-\s*(.+)/);
      if (dashMatch) {
        appointmentType = dashMatch[1].trim();
        patientName = dashMatch[2].trim();
      }
    }

    // Mark breaks
    let patientCode = null;
    if (summary.toLowerCase().startsWith('break')) {
      patientName = 'Break';
      appointmentType = '';
    } else if (patientName && patientName !== 'Break') {
      // Mint (idempotent) an opaque code for this patient; real name stays in the key file only
      const norm = manaKeys.normalize(patientName);
      const isNew = !keyStore.by_name[norm];
      const code = manaKeys.mint(keyStore, patientName);
      if (code) {
        patientCode = code;
        if (isNew) keysDirty = true;
      }
    }

    // Scrub raw_summary: replace the patient's name with the code so no PHI lands in the DB
    let rawSummary = summary;
    if (patientCode && patientName && summary.includes(patientName)) {
      rawSummary = summary.replace(patientName, patientCode);
    }

    const row = {
      jane_uid: uid,
      patient_code: patientCode,
      appointment_type: appointmentType,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      duration_minutes: durationMinutes,
      status,
      raw_summary: rawSummary,
      source: 'ical',
      updated_at: new Date().toISOString()
    };
    // No PHI at rest: patient_name is intentionally omitted for new rows
    if (patientName === 'Break') row.patient_name = 'Break';

    const { error } = await supabase
      .from('mana_appointments')
      .upsert(row, {
        onConflict: 'jane_uid',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`Error upserting ${uid}: ${error.message}`);
    } else {
      if (!event.dtstart) inserted++;
      updated++;
    }
  }

  // ── Cleanup: remove ical rows within the feed's date window that are no longer in the feed ──
  // Jane's iCal feed is a rolling window (~2 months). Rows outside [earliest, latest] may be
  // legitimately absent (historical records kept for analytics, future bookings not yet covered),
  // so only delete rows whose appointment_date falls inside the window and whose jane_uid is gone.
  let feedMin = null;
  let feedMax = null;
  const feedUids = new Set();
  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;
    feedUids.add(uid);
    if (event.start) {
      const t = new Date(event.start).getTime();
      if (feedMin === null || t < feedMin) feedMin = t;
      if (feedMax === null || t > feedMax) feedMax = t;
    }
  }

  if (feedMin !== null) {
    const winStart = new Date(feedMin).toISOString().split('T')[0];
    const winEnd = new Date(feedMax).toISOString().split('T')[0];

    const { data: existing, error: fetchErr } = await supabase
      .from('mana_appointments')
      .select('id, jane_uid, appointment_date')
      .eq('source', 'ical');

    if (fetchErr) {
      console.error(`Cleanup: failed to fetch existing rows: ${fetchErr.message}`);
    } else if (existing) {
      const stale = existing.filter(r => {
        if (!r.jane_uid) return false;                    // not feed-managed
        if (feedUids.has(r.jane_uid)) return false;       // still in feed
        const d = r.appointment_date || '';
        return d >= winStart && d <= winEnd;              // inside rolling window → genuinely removed
      });

      if (stale.length > 0) {
        const staleIds = stale.map(r => r.id);
        const { error: delErr } = await supabase
          .from('mana_appointments')
          .delete()
          .in('id', staleIds);
        if (delErr) {
          console.error(`Cleanup: failed to delete ${staleIds.length} stale rows: ${delErr.message}`);
        } else {
          console.log(`Cleanup: removed ${staleIds.length} stale rows not in feed (${stale.map(s => `${s.appointment_date} ${s.jane_uid.split('@')[0]}`).join(', ')})`);
        }
      } else {
        console.log('Cleanup: no stale rows');
      }
    }
  }

  if (keysDirty) {
    manaKeys.saveKeys(keyStore);
    console.log('Key file updated with new patient codes.');
  }

  const total = Object.keys(events).filter(k => events[k].type === 'VEVENT').length;
  console.log(`Sync complete: ${total} events processed`);
}

sync().catch(err => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
