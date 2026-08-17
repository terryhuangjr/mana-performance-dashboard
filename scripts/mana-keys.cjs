#!/usr/bin/env node
/**
 * mana-keys.cjs — MANA patient key-file manager (AES-256-GCM)
 *
 * PHI/PII compliance: Supabase stores ONLY opaque codes (MANA001, MANA002...).
 * The real identity lives in ONE encrypted key file on this box:
 *   ~/.hermes/profiles/russ-mana/state/patient_keys.json (chmod 600, gitignored)
 * Encryption key: MANA_KEYS_MASTER_KEY env (32-byte hex) — never stored in the file.
 *
 * Usage:
 *   node scripts/mana-keys.cjs seed                      # build key file from existing Supabase patient_name values
 *   node scripts/mana-keys.cjs backfill-codes            # write patient_code into existing rows (name → code)
 *   node scripts/mana-keys.cjs mint <name>               # mint a new code for a name (idempotent: returns existing)
 *   node scripts/mana-keys.cjs resolve <MANA001>         # print real name for a code
 *   node scripts/mana-keys.cjs lookup <name-substr>      # find code(s) for a name fragment
 *   node scripts/mana-keys.cjs list                      # all codes (codes only, no names — safe)
 *   node scripts/mana-keys.cjs validate                  # check file integrity + env key present
 *   node scripts/mana-keys.cjs rotate                    # re-encrypt with a NEW master key (requires MANA_KEYS_NEW_KEY)
 *
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MANA_KEYS_MASTER_KEY
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

const KEYS_FILE = process.env.MANA_KEYS_FILE || path.join(os.homedir(), '.hermes', 'profiles', 'russ-mana', 'state', 'patient_keys.json');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function getMasterKey() {
  const hex = process.env.MANA_KEYS_MASTER_KEY;
  if (!hex) {
    console.error('ERROR: MANA_KEYS_MASTER_KEY env not set (32-byte hex)');
    process.exit(1);
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    console.error(`ERROR: MANA_KEYS_MASTER_KEY must be 32 bytes (64 hex chars), got ${buf.length}`);
    process.exit(1);
  }
  return buf;
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') };
}

function decrypt(payload, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

function loadKeys() {
  if (!fs.existsSync(KEYS_FILE)) return { version: 1, next_seq: 1, by_code: {}, by_name: {} };
  const raw = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  const key = getMasterKey();
  const plain = decrypt(raw.payload, key);
  return JSON.parse(plain);
}

function saveKeys(store) {
  const key = getMasterKey();
  const payload = encrypt(JSON.stringify(store, null, 2), key);
  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ version: 1, encrypted: true, payload }, null, 2), { mode: 0o600 });
  fs.chmodSync(KEYS_FILE, 0o600);
  console.log(`Saved ${Object.keys(store.by_code).length} keys → ${KEYS_FILE}`);
}

function normalize(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function codeFor(seq) {
  return `MANA${String(seq).padStart(3, '0')}`;
}

function mint(store, name) {
  const norm = normalize(name);
  if (!norm) return null;
  if (store.by_name[norm]) return store.by_name[norm]; // idempotent
  const code = codeFor(store.next_seq);
  store.by_code[code] = { name: name.trim(), normalized: norm, created_at: new Date().toISOString() };
  store.by_name[norm] = code;
  store.next_seq += 1;
  return code;
}

async function seedFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY required for seed');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const store = loadKeys();
  let added = 0;

  // 1) known patients table (the canonical 66)
  const { data: known, error: err1 } = await supabase.from('mana_known_patients').select('patient_name');
  if (err1) { console.error('mana_known_patients error:', err1.message); process.exit(1); }
  for (const row of known || []) {
    if (mint(store, row.patient_name)) added++;
  }

  // 2) appointments (dedupe by patient_name)
  const { data: appts, error: err2 } = await supabase.from('mana_appointments').select('patient_name').not('patient_name', 'is', null);
  if (err2) { console.error('mana_appointments error:', err2.message); process.exit(1); }
  for (const row of appts || []) {
    const name = String(row.patient_name || '').trim();
    if (!name || name === 'Break' || name.toLowerCase().includes('break')) continue;
    if (mint(store, name)) added++;
  }

  // 3) speed-lead + winback logs
  for (const table of ['mana_speed_lead_log', 'mana_winback_log']) {
    const { data: rows, error: err3 } = await supabase.from(table).select('patient_name').not('patient_name', 'is', null);
    if (err3) { console.error(`${table} error:`, err3.message); continue; }
    for (const row of rows || []) {
      const name = String(row.patient_name || '').trim();
      if (!name || name === 'Break' || name.toLowerCase().includes('break')) continue;
      if (mint(store, name)) added++;
    }
  }

  saveKeys(store);
  console.log(`Seed complete: ${added} new, ${Object.keys(store.by_code).length} total codes.`);
}

async function backfillCodes() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY required');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const store = loadKeys();
  if (Object.keys(store.by_code).length === 0) {
    console.error('ERROR: key file empty — run `seed` first');
    process.exit(1);
  }
  let updated = 0;
  // helper: get code for a stored name (exact normalized match), else null
  const codeForName = (name) => {
    const norm = normalize(name);
    if (!norm) return null;
    // direct normalized lookup first
    if (store.by_name[norm]) return store.by_name[norm];
    // fallback: strip trailing period (Jane uses "Charlotte M." style) + match by_code name normalized
    const stripped = norm.replace(/\.$/, '');
    for (const [c, rec] of Object.entries(store.by_code)) {
      if (normalize(rec.name).replace(/\.$/, '') === stripped) return c;
    }
    return null;
  };

  const tables = ['mana_appointments', 'mana_known_patients', 'mana_speed_lead_log', 'mana_winback_log'];
  let rlsBlocked = [];
  for (const table of tables) {
    const { data: rows, error: err } = await supabase.from(table).select('id, patient_name').not('patient_name', 'is', null);
    if (err) { console.error(`${table}: ${err.message}`); continue; }
    for (const row of rows || []) {
      const name = String(row.patient_name || '').trim();
      if (!name || name === 'Break' || name.toLowerCase().includes('break')) continue;
      const code = codeForName(name);
      if (!code) { console.warn(`${table} ${row.id}: no code for "${name}"`); continue; }
      const { error: upErr } = await supabase.from(table).update({ patient_code: code }).eq('id', row.id);
      if (upErr) {
        // RLS-blocked (legacy source='jane' rows) — collect for service-role pass
        rlsBlocked.push({ table, id: row.id, code });
        continue;
      }
      updated++;
    }
    console.log(`${table}: done`);
  }

  // mana_pipeline uses first_name + last_initial instead of patient_name
  {
    const { data: rows, error: err } = await supabase.from('mana_pipeline').select('id, first_name, last_initial');
    if (err) { console.error(`mana_pipeline: ${err.message}`); }
    else for (const row of rows || []) {
      const name = [row.first_name, row.last_initial].filter(Boolean).join(' ').trim();
      if (!name) continue;
      const code = codeForName(name);
      if (!code) {
        // try just first_name (pipeline may lack last initial)
        const code2 = codeForName(row.first_name);
        if (!code2) { console.warn(`mana_pipeline ${row.id}: no code for "${name}"`); continue; }
        const { error: upErr } = await supabase.from('mana_pipeline').update({ patient_code: code2 }).eq('id', row.id);
        if (upErr) rlsBlocked.push({ table: 'mana_pipeline', id: row.id, code: code2 });
        else updated++;
      } else {
        const { error: upErr } = await supabase.from('mana_pipeline').update({ patient_code: code }).eq('id', row.id);
        if (upErr) rlsBlocked.push({ table: 'mana_pipeline', id: row.id, code });
        else updated++;
      }
    }
    console.log('mana_pipeline: done');
  }
  if (rlsBlocked.length) {
    console.log(`\nRLS_BLOCKED=${rlsBlocked.length} (need service-role pass)`);
    for (const b of rlsBlocked) console.log(`BLOCKED\t${b.table}\t${b.id}\t${b.code}`);
  }
  console.log(`Backfill complete: ${updated} rows updated.`);
}

const cmd = process.argv[2];

if (require.main === module) {
  if (cmd === 'seed') {
    seedFromSupabase().catch(e => { console.error(e); process.exit(1); });
  } else if (cmd === 'backfill-codes') {
    backfillCodes().catch(e => { console.error(e); process.exit(1); });
  } else if (cmd === 'mint') {
    const name = process.argv.slice(3).join(' ');
    const store = loadKeys();
    const code = mint(store, name);
    if (!code) { console.error('ERROR: empty name'); process.exit(1); }
    saveKeys(store);
    console.log(`${code}\t${name}`);
  } else if (cmd === 'resolve') {
    const code = String(process.argv[3] || '').trim().toUpperCase();
    const store = loadKeys();
    const rec = store.by_code[code];
    if (!rec) { console.log(`NOT_FOUND: ${code}`); process.exit(0); }
    console.log(rec.name);
  } else if (cmd === 'lookup') {
    const frag = normalize(process.argv.slice(3).join(' '));
    const store = loadKeys();
    for (const [norm, code] of Object.entries(store.by_name)) {
      if (norm.includes(frag)) console.log(`${code}\t${store.by_code[code].name}`);
    }
  } else if (cmd === 'list') {
    const store = loadKeys();
    for (const code of Object.keys(store.by_code).sort()) console.log(code);
  } else if (cmd === 'validate') {
    const store = loadKeys();
    console.log(`OK: ${Object.keys(store.by_code).length} codes, next_seq=${store.next_seq}`);
  } else if (cmd === 'rotate') {
    const newKey = process.env.MANA_KEYS_NEW_KEY;
    if (!newKey || Buffer.from(newKey, 'hex').length !== 32) {
      console.error('ERROR: MANA_KEYS_NEW_KEY env not set (32-byte hex)');
      process.exit(1);
    }
    const store = loadKeys(); // verifies old key works
    const tmp = process.env.MANA_KEYS_MASTER_KEY;
    process.env.MANA_KEYS_MASTER_KEY = newKey;
    saveKeys(store);
    process.env.MANA_KEYS_MASTER_KEY = tmp;
    console.log('Rotated OK — new master key now in use. Update .env!');
  } else {
    console.log(`Usage:
  node scripts/mana-keys.cjs seed
  node scripts/mana-keys.cjs backfill-codes
  node scripts/mana-keys.cjs mint <name>
  node scripts/mana-keys.cjs resolve <MANA001>
  node scripts/mana-keys.cjs lookup <name-fragment>
  node scripts/mana-keys.cjs list
  node scripts/mana-keys.cjs validate
  node scripts/mana-keys.cjs rotate`);
    process.exit(0);
  }
}

module.exports = {
  loadKeys, saveKeys, mint, resolve: (code) => loadKeys().by_code[String(code).toUpperCase()]?.name || null,
  normalize, codeFor, KEYS_FILE, getMasterKey
};
