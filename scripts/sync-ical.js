#!/usr/bin/env node
/**
 * MANA iCal Sync Script
 * Fetches Jane iCal feed, parses appointments, upserts into Supabase.
 * Run via cron every 15 minutes.
 *
 * Usage: node scripts/sync-ical.js
 *
 * Env vars required:
 *   JANE_ICAL_URL — the private iCal feed URL from Jane
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — Supabase project credentials
 */

const ical = require('node-ical');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const ICAL_URL = process.env.JANE_ICAL_URL;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!ICAL_URL) {
  console.error('ERROR: JANE_ICAL_URL not set');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY required');
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
  let skipped = 0;
  let newPipelineEntries = 0;
  let pipelinePatientNames = new Set();

  // Fetch all existing pipeline patient names for quick lookup
  try {
    const { data: pipelineData, error: pipelineError } = await supabase
      .from('mana_pipeline')
      .select('first_name, last_initial');
    if (!pipelineError && pipelineData) {
      for (const p of pipelineData) {
        pipelinePatientNames.add(`${p.first_name} ${p.last_initial}`);
      }
    }
  } catch (err) {
    console.warn(`Could not fetch pipeline data: ${err.message}`);
  }

  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;

    const janeUid = uid;
    const summary = event.summary || '';
    const description = event.description || '';
    const location = event.location || '';

    // Parse date/time
    let appointmentDate, appointmentTime, durationMinutes;

    if (event.start) {
      const start = new Date(event.start);
      appointmentDate = start.toISOString().split('T')[0];
      appointmentTime = start.toTimeString().slice(0, 5);
    } else {
      skipped++;
      continue;
    }

    if (event.end && event.start) {
      const end = new Date(event.end);
      const start = new Date(event.start);
      durationMinutes = Math.round((end - start) / 60000);
    } else {
      durationMinutes = 60;
    }

    // Determine status
    const isCancelled = summary.toLowerCase().includes('cancelled') ||
      event.status === 'CANCELLED';
    const status = isCancelled ? 'cancelled' : 'confirmed';

    // Extract patient name and type from summary
    // Jane format varies — store raw summary, parse what we can
    let patientName = summary;
    let appointmentType = '';

    // Try common Jane formats:
    // "Initial Evaluation - Sarah Johnson"
    // "Follow-up - Mike Chen"
    // "Manual Therapy - James Wilson"
    const typeMatch = summary.match(/^([^-]+)\s*-\s*(.+)/);
    if (typeMatch) {
      appointmentType = typeMatch[1].trim();
      patientName = typeMatch[2].trim();
    }

    // TODO: Appointment type mapping configuration
    // Once Russ confirms exact type names in Jane, we can map them:
    // "Initial Evaluation" → "eval"
    // "Follow-up Session" → "follow-up"
    // "Manual Therapy" → "manual"
    // etc.

    const { data, error } = await supabase
      .from('mana_appointments')
      .upsert({
        jane_uid: janeUid,
        patient_name: patientName,
        appointment_type: appointmentType,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration_minutes: durationMinutes,
        status,
        raw_summary: summary,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'jane_uid',
        ignoreDuplicates: false
      })
      .select('id');

    if (error) {
      console.error(`Error upserting ${janeUid}: ${error.message}`);
      skipped++;
    } else {
      if (data && data.length > 0) {
        // Check if it was an insert or update
        if (data[0].created_at === data[0].updated_at) {
          inserted++;
        } else {
          updated++;
        }
      }

      // Auto-create pipeline entry for new Jane patients (first-time booking)
      // Skip cancelled appointments, manual entries, and existing pipeline patients
      if (!isCancelled && patientName && patientName !== 'Unknown' && patientName !== '') {
        // Parse first name and last initial from patient name
        const nameParts = patientName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : '?';
        const pipelineKey = `${firstName} ${lastInitial}`;

        if (!pipelinePatientNames.has(pipelineKey)) {
          // New patient — add to pipeline
          const evalDate = appointmentType.toLowerCase().includes('eval') ||
            appointmentType.toLowerCase().includes('initial') ? appointmentDate : null;

          const month = parseInt(appointmentDate.split('-')[1]);
          const year = parseInt(appointmentDate.split('-')[0]);

          const { error: pipeError } = await supabase
            .from('mana_pipeline')
            .insert({
              first_name: firstName,
              last_initial: lastInitial,
              eval_date: evalDate || appointmentDate,
              contacted: false,
              converted: null,
              month,
              year,
              notes: `Auto-created from Jane booking: ${appointmentType} on ${appointmentDate}`
            });

          if (pipeError) {
            console.warn(`Could not create pipeline entry for ${pipelineKey}: ${pipeError.message}`);
          } else {
            pipelinePatientNames.add(pipelineKey);
            newPipelineEntries++;
          }
        }
      }
    }
  }

  const total = Object.keys(events).filter(k => events[k].type === 'VEVENT').length;
  let summary = `Sync complete: ${total} events, ${inserted} new, ${updated} updated, ${skipped} skipped`;
  if (newPipelineEntries > 0) {
    summary += `, ${newPipelineEntries} new pipeline entries created`;
  }
  console.log(summary);
}

sync().catch(err => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
