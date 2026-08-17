#!/usr/bin/env node
/**
 * trainerize-poll.cjs — Poll Trainerize API for client list, tokenize, upsert into Supabase.
 *
 * PHI policy: client names never land in Supabase. Names are minted into the encrypted
 * key file (mana-keys.cjs) and Supabase gets only the opaque code (MANA001).
 *
 * Env: TRAINERIZE_GROUP_ID, TRAINERIZE_API_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *      MANA_KEYS_MASTER_KEY
 *
 * Usage: node scripts/trainerize-poll.cjs [--limit 100]
 */

const { createClient } = require('@supabase/supabase-js');
const manaKeys = require('./mana-keys.cjs');

const GROUP_ID = process.env.TRAINERIZE_GROUP_ID;
const API_TOKEN = process.env.TRAINERIZE_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!GROUP_ID || !API_TOKEN) {
  console.error('ERROR: TRAINERIZE_GROUP_ID / TRAINERIZE_API_TOKEN required');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY required');
  process.exit(1);
}

const API_BASE = 'https://api.trainerize.com/v03';
const BASIC = 'Basic ' + Buffer.from(`${GROUP_ID}:${API_TOKEN}`).toString('base64');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const keyStore = manaKeys.loadKeys();
let keysDirty = false;

async function trainerizePost(endpoint, body = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': BASIC,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 429) {
    console.error('Trainerize rate limit (429) — retry later');
    process.exit(2);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${endpoint} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function pollClients() {
  console.log(`[${new Date().toISOString()}] Polling Trainerize getClientList...`);
  const data = await trainerizePost('user/getClientList', {});

  // Trainerize returns various shapes; normalize defensively
  let clients = [];
  if (Array.isArray(data)) clients = data;
  else if (data && Array.isArray(data.clients)) clients = data.clients;
  else if (data && Array.isArray(data.data)) clients = data.data;
  else if (data && typeof data === 'object') {
    // scan for any array-valued key that looks like clients
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object' && (v[0].userid || v[0].id || v[0].email)) {
        clients = v;
        break;
      }
    }
  }

  if (!clients.length) {
    console.log('No clients returned (or unexpected shape). Raw keys:', Object.keys(data || {}));
    // don't fail hard — the API may return { success: true, data: [] } legitimately
    return 0;
  }

  let added = 0;
  let upserted = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const c of clients) {
    // Name fields vary: firstname/lastname, firstName/lastName, name
    const first = c.firstname || c.firstName || (c.name ? c.name.split(' ')[0] : '') || '';
    const last = c.lastname || c.lastName || (c.name ? c.name.split(' ').slice(1).join(' ') : '') || '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (!full) continue;

    // Trainerize client id — if present, store as a secondary reference (NOT a name)
    const tzId = c.userid || c.id || null;

    const norm = manaKeys.normalize(full);
    const isNew = !keyStore.by_name[norm];
    const code = manaKeys.mint(keyStore, full);
    if (!code) continue;
    if (isNew) {
      keysDirty = true;
      added++;
    }

    const { error } = await supabase
      .from('mana_known_patients')
      .upsert({
        patient_code: code,
        first_seen_date: today,
        source: 'trainerize',
        // no patient_name — Supabase stores codes only
      }, { onConflict: 'patient_code', ignoreDuplicates: false });

    // NOTE: patient_code may not have a unique constraint; if upsert conflicts,
    // fall back to update-by-code. Check error message.
    if (error && error.message && error.message.includes('duplicate key')) {
      const { error: upErr } = await supabase
        .from('mana_known_patients')
        .update({ source: 'trainerize', first_seen_date: today })
        .eq('patient_code', code);
      if (upErr) console.error(`update ${code}: ${upErr.message}`);
      else upserted++;
    } else if (error) {
      console.error(`upsert ${code}: ${error.message}`);
    } else {
      upserted++;
    }
  }

  if (keysDirty) {
    manaKeys.saveKeys(keyStore);
    console.log('Key file updated.');
  }
  console.log(`Poll complete: ${clients.length} clients, ${added} new codes, ${upserted} upserted.`);
  return clients.length;
}

const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : null;

pollClients()
  .then(n => { process.exit(0); })
  .catch(e => { console.error(`Poll failed: ${e.message}`); process.exit(1); });
