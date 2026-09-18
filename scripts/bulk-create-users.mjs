/**
 * Creates several accounts at once, for handing the dashboard to a team.
 *
 * The credentials are NOT in this file and must never be. They are read from a
 * local input file that .gitignore excludes (scripts/.bulk-users.local.*), and
 * only PBKDF2 hashes reach the database — the passwords themselves are never
 * printed, never logged, and never written anywhere but that input file.
 *
 *   node scripts/bulk-create-users.mjs --local        # the wrangler dev copy
 *   node scripts/bulk-create-users.mjs                # production
 *
 * Options:
 *   --file <path>     input file (default scripts/.bulk-users.local.json)
 *   --role <role>     role for rows that do not state one (default viewer)
 *   --delete-input    shred the input file once every account is created
 *
 * Input is either a JSON array:
 *   [{ "username": "a@b.mn", "password": "…", "role": "viewer" }, …]
 * or one "<username> <password>" per line, which is what a pasted list looks
 * like. "email" is accepted in place of "username".
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './lib/pbkdf2.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = path.join(here, '.bulk-users.local.json');
const DB = 'heiwa-dashboard-users';
const ROLES = ['viewer', 'editor', 'admin'];
const MIN_PASSWORD = 10;

function parseArgs(argv) {
  const args = { local: false, file: DEFAULT_INPUT, role: 'viewer', deleteInput: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--local') args.local = true;
    else if (a === '--delete-input') args.deleteInput = true;
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--role') args.role = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

/** Accepts the JSON array or the plain "<username> <password>" line format. */
function parseInput(raw, defaultRole) {
  const text = raw.trim();
  if (!text) return [];

  if (text.startsWith('[')) {
    return JSON.parse(text).map((row) => ({
      username: String(row.username ?? row.email ?? '').trim(),
      password: String(row.password ?? ''),
      role: row.role ?? defaultRole,
    }));
  }

  return text.split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [username, ...rest] = line.split(/\s+/);
      return { username, password: rest.join(' '), role: defaultRole };
    });
}

/** Mirrors usernameKey() in worker/users.ts — logins compare on this. */
function usernameKey(username) {
  return username.normalize('NFC').trim().toLowerCase();
}

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function d1(args, { local }) {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, local ? '--local' : '--remote', ...args, '-y', '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
}

function existingKeys({ local }) {
  const out = d1(['--command', 'SELECT username_key FROM users;'], { local });
  const json = JSON.parse(out.slice(out.indexOf('[')));
  return new Set((json[0]?.results ?? []).map((r) => r.username_key));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!ROLES.includes(args.role)) throw new Error(`--role must be one of: ${ROLES.join(', ')}`);
  if (!existsSync(args.file)) {
    throw new Error(
      `Input file not found: ${args.file}\n`
      + 'Create it with one {"username","password"} per entry, or one '
      + '"<username> <password>" per line. It is gitignored.',
    );
  }

  console.log(`Target: ${args.local ? 'LOCAL (wrangler dev)' : 'PRODUCTION'} database\n`);

  const rows = parseInput(readFileSync(args.file, 'utf8'), args.role);
  if (rows.length === 0) throw new Error('The input file has no entries.');

  // Validate everything before writing anything — a half-applied batch is
  // worse than a refused one, since the operator cannot tell what landed.
  const problems = [];
  const seen = new Set();
  for (const [i, row] of rows.entries()) {
    const where = `entry ${i + 1}${row.username ? ` (${row.username})` : ''}`;
    if (!row.username) problems.push(`${where}: no username`);
    if (row.password.length < MIN_PASSWORD) {
      problems.push(`${where}: password shorter than ${MIN_PASSWORD} characters`);
    }
    if (!ROLES.includes(row.role)) problems.push(`${where}: unknown role "${row.role}"`);
    const key = usernameKey(row.username ?? '');
    if (seen.has(key)) problems.push(`${where}: listed twice in the input`);
    seen.add(key);
  }
  if (problems.length) {
    throw new Error(`Input rejected, nothing written:\n  ${problems.join('\n  ')}`);
  }

  const already = existingKeys(args);
  const toCreate = rows.filter((r) => !already.has(usernameKey(r.username)));
  const skipped = rows.filter((r) => already.has(usernameKey(r.username)));

  for (const row of skipped) console.log(`  skipped  ${row.username} — already exists`);

  if (toCreate.length === 0) {
    console.log('\nEvery account in the input already exists. Nothing to do.');
    return;
  }

  const now = new Date().toISOString();
  const values = [];
  for (const row of toCreate) {
    values.push(`(${[
      quote(crypto.randomUUID()),
      quote(row.username.trim()),
      quote(usernameKey(row.username)),
      quote(await hashPassword(row.password)),
      quote(row.role),
      quote(now),
      quote(now),
    ].join(', ')})`);
  }
  const sql = 'INSERT INTO users (id, username, username_key, password_hash, role, created_at, updated_at)'
    + ` VALUES\n${values.join(',\n')};`;

  // Through a file rather than --command: the hashes would otherwise sit in the
  // process list for as long as wrangler runs.
  const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-bulk-'));
  const file = path.join(dir, 'insert.sql');
  try {
    writeFileSync(file, `${sql}\n`, { mode: 0o600 });
    d1(['--file', file], args);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('');
  for (const row of toCreate) console.log(`  created  ${row.username}  (${row.role})`);
  console.log(`\n${toCreate.length} created, ${skipped.length} skipped.`);

  if (args.deleteInput) {
    rmSync(args.file, { force: true });
    console.log(`Deleted ${args.file}.`);
  } else {
    console.log(`\nThe input file still holds these passwords in plain text:\n  ${args.file}`);
    console.log('It is gitignored, but delete it once the credentials are handed out:');
    console.log(`  rm ${args.file}`);
  }
}

main().catch((err) => {
  console.error(`\n${err.message ?? err}`);
  process.exit(1);
});
