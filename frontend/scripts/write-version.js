import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = Date.now().toString();
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });
writeFileSync(
  join(publicDir, 'version.json'),
  JSON.stringify({ version }, null, 0)
);
