#!/usr/bin/env node
// trainerize-process.cjs — consume trainerize_webhook_events (idempotent).
//
// Gap fix: the webhook receiver stores events but nothing applied them. This
// processor tokenizes client.added payloads into mana_known_patients (code only,
// no PHI), no-ops pings, and marks every event processed so replay is safe.
//
// Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MANA_KEYS_MASTER_KEY
// Usage: node scripts/trainerize-process.cjs
const { createClient } = require('@supabase/supabase-js');
const manaKeys = require('./mana-keys.cjs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('ERROR: Supabase env required'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const keyStore = manaKeys.loadKeys();
let keysDirty = false;

function classifyEvent(ev) {
  const type = ev.event_type || (ev.payload || {}).event || 'unknown';
  if (type === 'client.added') {
    const p = ev.payload || {};
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return full ? { action: 'add', name: full } : { action: 'skip', reason: 'no-name' };
  }
  if (type === 'ping') return { action: 'noop' };
  return { action: 'mark', reason: 'unknown-type' };
}

async function processEvents() {
  const { data: events, error } = await supabase
    .from('trainerize_webhook_events')
    .select('*')
    .eq('processed', false)
    .order('id', { ascending: true })
    .limit(50);
  if (error) { console.error(`Fetch events: ${error.message}`); process.exit(1); }
  if (!events || events.length === 0) { console.log('No unprocessed events.'); return; }

  let handled = 0, skipped = 0;
  const today = new Date().toISOString().split('T')[0];
  for (const ev of events) {
    const cls = classifyEvent(ev);
    try {
      if (cls.action === 'add') {
        const code = manaKeys.mint(keyStore, cls.name);
        if (code) keysDirty = true;
        const { error: upErr } = await supabase.from('mana_known_patients')
          .upsert({ patient_code: code, first_seen_date: today, source: 'trainerize' },
            { onConflict: 'patient_code', ignoreDuplicates: false });
        if (upErr && upErr.message && !upErr.message.includes('duplicate')) {
          console.error(`known_patients upsert ${code}: ${upErr.message}`);
        }
        console.log(`client.added ${ev.id}: ${code}`);
        handled++;
      } else if (cls.action === 'noop') {
        console.log(`ping ${ev.id}: no-op`);
        handled++;
      } else if (cls.action === 'skip') {
        console.warn(`client.added ${ev.id}: ${cls.reason}, skip`);
        skipped++;
      } else {
        console.log(`event ${ev.id} (${ev.event_type}): unhandled type, marking processed`);
        handled++;
      }
      const { error: markErr } = await supabase.from('trainerize_webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          // PHI scrub: once processed, drop any name fields from the staging payload
          payload: cls.action === 'add'
            ? { ...(ev.payload || {}), firstName: null, lastName: null, email: null }
            : ev.payload,
        }).eq('id', ev.id);
      if (markErr) console.error(`mark processed ${ev.id}: ${markErr.message}`);
    } catch (e) {
      console.error(`event ${ev.id}: ${e.message}`);
      skipped++;
    }
  }
  if (keysDirty) { manaKeys.saveKeys(keyStore); console.log('Key file updated.'); }
  console.log(`Processed ${handled} events (${skipped} skipped/failed).`);
}

processEvents().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
