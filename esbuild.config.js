const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure public/ exists
fs.mkdirSync('public', { recursive: true });

// Copy index.html and other static HTML to public/
const staticFiles = ['index.html', 'contact.html', 'cookies.html', 'privacy.html', 'terms.html'];
staticFiles.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('public', f));
    console.log(`  📄 Copied ${f} → public/${f}`);
  }
});

// Copy service worker if it exists
if (fs.existsSync('sw.js')) {
  fs.copyFileSync('sw.js', 'public/sw.js');
  console.log('  📄 Copied sw.js → public/sw.js');
}

// Copy manifest if it exists
if (fs.existsSync('manifest.json')) {
  fs.copyFileSync('manifest.json', 'public/manifest.json');
  console.log('  📄 Copied manifest.json → public/manifest.json');
}

// Copy any icons/images
['favicon.ico', 'icon-192.png', 'icon-512.png', 'logo.png'].forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('public', f));
    console.log(`  📄 Copied ${f} → public/${f}`);
  }
});

// Build module bundle only if src/app.js exists and has content
const entry = 'src/app.js';
if (!fs.existsSync(entry)) {
  console.log('\n⏭  No src/app.js found, skipping module bundle');
  console.log('✅ Static files copied to public/');
  process.exit(0);
}

const content = fs.readFileSync(entry, 'utf8').trim();
if (!content || content.length < 10) {
  console.log('\n⏭  src/app.js is empty, skipping module bundle');
  console.log('✅ Static files copied to public/');
  process.exit(0);
}

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile: 'public/app.bundle.js',
  format: 'iife',
  globalName: 'HuddledinModules',
  minify: false,
  sourcemap: true,
  target: 'es2020',
  loader: { '.css': 'text' },
}).then(() => {
  console.log('\n✅ Module build complete → public/app.bundle.js');
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
