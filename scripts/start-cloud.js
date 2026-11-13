/**
 * Starts Expo with the cloud values from .env.production (real Supabase project, e-mails sent
 * by Resend to real addresses) instead of the local database from .env.
 * Values already present in the environment win over .env files, so the cloud values replace
 * the local ones without touching either file.
 */
const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const file = join(__dirname, '..', '.env.production');

if (!existsSync(file)) {
  console.error(
    '.env.production fehlt. Kopiere .env.production.example und trage die Cloud-Werte ein.',
  );
  process.exit(1);
}

const cloudValues = {};
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const match = /^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (match) {
    cloudValues[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

if (!cloudValues.EXPO_PUBLIC_SUPABASE_URL || !cloudValues.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    'In .env.production fehlen EXPO_PUBLIC_SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
  process.exit(1);
}

console.log(`Cloud-Modus: ${cloudValues.EXPO_PUBLIC_SUPABASE_URL}`);

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...cloudValues },
});
child.on('exit', (code) => process.exit(code ?? 0));
