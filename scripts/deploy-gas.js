// Push gas/ and update the fixed deployment, so the API URL never changes.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const idFile = path.join(root, '.deployment-id');
if (!fs.existsSync(idFile)) { console.error('Missing .deployment-id'); process.exit(1); }
const id = fs.readFileSync(idFile, 'utf8').trim();
const clasp = process.platform === 'win32' ? 'clasp.cmd' : 'clasp';
const run = (cmd) => { console.log('>', cmd); execSync(cmd, { cwd: root, stdio: 'inherit' }); };

run(`${clasp} push -f`);
run(`${clasp} deploy -i ${id} -d "deploy ${new Date().toISOString().slice(0, 16)}"`);
console.log(`API: https://script.google.com/macros/s/${id}/exec`);
