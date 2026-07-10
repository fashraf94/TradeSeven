// Peek at fixture structure for A3/A4/A5 characterization
import fs from 'node:fs/promises';

const file = process.argv[2];
const raw = await fs.readFile(file, 'utf8');
const parsed = JSON.parse(raw);
const arr = Array.isArray(parsed) ? parsed : (parsed.earnings || parsed.data || Object.values(parsed)[0]);

console.log(`File: ${file}`);
console.log(`Top-level type: ${Array.isArray(parsed) ? 'array' : `object with keys: ${Object.keys(parsed).join(',')}`}`);
console.log(`Records: ${arr?.length ?? 'n/a'}`);
console.log(`First 3:`);
for (let i = 0; i < 3 && i < arr.length; i++) console.log(JSON.stringify(arr[i]));
console.log(`Last 3:`);
for (let i = Math.max(0, arr.length-3); i < arr.length; i++) console.log(JSON.stringify(arr[i]));
if (arr.length > 0) {
  console.log(`Keys: ${Object.keys(arr[0]).join(', ')}`);
}
