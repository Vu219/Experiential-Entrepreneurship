// Prepare the QA entry in an existing HEAD checkout; app source stays untouched.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(root, 'src/components/Modal.tsx'))) throw new Error('Pass the absolute frontend directory of the baseline checkout.');
const preview = fs.readFileSync(new URL('./SharedPreview.tsx', import.meta.url), 'utf8')
 .replaceAll('../../src/', './src/').replace(/^const sync =.*$/m, 'const sync = () => {};');
fs.writeFileSync(path.join(root, 'SharedPreview.tsx'), preview);
// node_modules may be a junction to the active checkout: isolate Vite's optimizer cache.
fs.writeFileSync(path.join(root, 'dark-mode-qa.config.mjs'), "import react from '@vitejs/plugin-react'; export default {plugins:[react()],cacheDir:'.vite-dark-mode-qa',server:{port:3101,strictPort:true}};\n");
console.log('Prepared SharedPreview.tsx and dark-mode-qa.config.mjs in', root);
