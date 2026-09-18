/**
 * Creates an account directly in D1. Used once to make the first admin, since
 * there is no admin yet to create one through the UI, and afterwards to
 * recover if every admin account is lost.
 *
 *   node scripts/create-admin.mjs                 # production database
 *   node scripts/create-admin.mjs --local         # the wrangler dev copy
 *
 * Credentials are typed at the prompt and never passed as arguments: an
 * argument lands in shell history and in the process list. The password is not
 * echoed, is never written to a file, and only its PBKDF2 hash reaches D1.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { hashPassword } from './lib/pbkdf2.mjs';

const ROLES = ['viewer', 'editor', 'admin'];
const MIN_PASSWORD = 10;

function ask(prompt, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Swallow the echo of everything but the prompt itself.
    rl._writeToOutput = (chunk) => {
      if (chunk.startsWith(prompt)) rl.output.write(prompt);
    };
  }
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      if (hidden) rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

/** SQL string literal — the only user input that reaches the statement. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const local = process.argv.slice(2).includes('--local');
  console.log(`Creating an account in the ${local ? 'LOCAL (wrangler dev)' : 'PRODUCTION'} database.\n`);

  const username = (await ask('Username: ')).trim();
  if (!username) throw new Error('Username cannot be empty.');

  const password = await ask('Password (not echoed): ', { hidden: true });
  if (password.length < MIN_PASSWORD) {
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  }
  const again = await ask('Repeat password: ', { hidden: true });
  if (password !== again) throw new Error('The two passwords do not match.');

  const roleInput = (await ask(`Role [${ROLES.join('/')}] (default admin): `)).trim() || 'admin';
  if (!ROLES.includes(roleInput)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);

  const now = new Date().toISOString();
  const sql = 'INSERT INTO users (id, username, username_key, password_hash, role, created_at, updated_at)'
    + ` VALUES (${[
      quote(crypto.randomUUID()),
      quote(username),
      quote(username.normalize('NFC').trim().toLowerCase()),
      quote(await hashPassword(password)),
      quote(roleInput),
      quote(now),
      quote(now),
    ].join(', ')});`;

  // Via a file rather than --command: the hash would otherwise sit in the
  // process list for as long as wrangler runs.
  const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-admin-'));
  const file = path.join(dir, 'insert.sql');
  try {
    writeFileSync(file, `${sql}\n`, { mode: 0o600 });
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'heiwa-dashboard-users', local ? '--local' : '--remote', '--file', file, '-y'],
      { stdio: 'inherit' },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\nCreated ${roleInput} "${username}". Sign in at the dashboard with it.`);
  console.log('If this said UNIQUE constraint failed, that username already exists.');
}

main().catch((err) => {
  console.error(`\n${err.message ?? err}`);
  process.exit(1);
});
