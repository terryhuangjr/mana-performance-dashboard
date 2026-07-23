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

const ICAL_URL = process.env.JANE_ICAL_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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
    if (summary.toLowerCase().startsWith('break')) {
      patientName = 'Break';
      appointmentType = '';
    }

    const { error } = await supabase
      .from('mana_appointments')
      .upsert({
        jane_uid: uid,
        patient_name: patientName,
        appointment_type: appointmentType,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration_minutes: durationMinutes,
        status,
        raw_summary: summary,
        source: 'ical',
        updated_at: new Date().toISOString()
      }, {
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

  const total = Object.keys(events).filter(k => events[k].type === 'VEVENT').length;
  console.log(`Sync complete: ${total} events processed`);
}

sync().catch(err => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
