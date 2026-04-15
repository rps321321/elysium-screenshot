#!/usr/bin/env node
/**
 * Sign and upload the Firefox build to addons.mozilla.org.
 *
 * Reads AMO_JWT_ISSUER and AMO_JWT_SECRET from the environment (use the
 * `--env-file=.env` flag on the `node` invocation — see package.json).
 *
 * Defaults to --channel=listed (public AMO catalog). Pass --unlisted to
 * produce a self-signed xpi for private distribution instead.
 *
 * Prerequisite: `npm run build:firefox` must have been run, so that
 * .output/firefox-mv2/ exists.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { AMO_JWT_ISSUER, AMO_JWT_SECRET } = process.env;

if (!AMO_JWT_ISSUER || !AMO_JWT_SECRET) {
  console.error('Missing AMO_JWT_ISSUER or AMO_JWT_SECRET in environment.');
  console.error('Copy .env.example to .env and fill in both values from');
  console.error('https://addons.mozilla.org/developers/addon/api/key/.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, '.output', 'firefox-mv2');

if (!existsSync(sourceDir)) {
  console.error(`Build output not found at ${sourceDir}.`);
  console.error('Run `npm run build:firefox` first.');
  process.exit(1);
}

const channel = process.argv.includes('--unlisted') ? 'unlisted' : 'listed';

const args = [
  'web-ext',
  'sign',
  `--channel=${channel}`,
  `--source-dir=${sourceDir}`,
  `--artifacts-dir=${path.join(root, '.output', 'signed')}`,
  `--api-key=${AMO_JWT_ISSUER}`,
  `--api-secret=${AMO_JWT_SECRET}`,
];

console.log(`Signing Firefox build (channel=${channel})...`);

const result = spawnSync('npx', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
