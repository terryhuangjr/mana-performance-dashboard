#!/usr/bin/env node
/**
 * mana-resolve.cjs — resolve MANA codes ↔ names for private DM use.
 *
 * PHI POLICY: This tool prints REAL NAMES. It is for Russ's private DM with the
 * MANA agent ONLY — never run in group chats, never log output, never store results.
 *
 * Usage:
 *   node scripts/mana-resolve.cjs resolve MANA001        # code → name
 *   node scripts/mana-resolve.cjs lookup "sara"          # name fragment → code(s)
 *   node scripts/mana-resolve.cjs list                   # codes + names (private only)
 *
 * Env: MANA_KEYS_MASTER_KEY
 */

const manaKeys = require('./mana-keys.cjs');

const cmd = process.argv[2];
if (!cmd) {
  console.log('Usage: mana-resolve <resolve MANA001 | lookup "name" | list>');
  process.exit(0);
}

try {
  const store = manaKeys.loadKeys();

  if (cmd === 'resolve') {
    const code = String(process.argv[3] || '').trim().toUpperCase();
    const rec = store.by_code[code];
    if (!rec) { console.log(`No patient found for ${code}`); process.exit(0); }
    console.log(`${code} → ${rec.name}`);
  } else if (cmd === 'lookup') {
    const frag = manaKeys.normalize(process.argv.slice(3).join(' '));
    if (!frag) { console.log('Provide a name fragment'); process.exit(0); }
    let found = 0;
    for (const [norm, code] of Object.entries(store.by_name)) {
      if (norm.includes(frag)) {
        console.log(`${code} → ${store.by_code[code].name}`);
        found++;
      }
    }
    if (!found) console.log(`No patient matching "${frag}"`);
  } else if (cmd === 'list') {
    for (const code of Object.keys(store.by_code).sort()) {
      console.log(`${code} → ${store.by_code[code].name}`);
    }
  } else {
    console.log(`Unknown command: ${cmd}`);
  }
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
}
