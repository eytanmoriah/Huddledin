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

// Copy service worker if it exists. Substitute __BUILD_VERSION__ → deploy timestamp
// so every build gets a unique CACHE_NAME, forcing the SW's activate cleanup to
// drop stale caches. Closes audit Report 03 #1 (sw.js cache versioning).
if (fs.existsSync('sw.js')) {
  const buildVersion = Date.now().toString();
  const swSource = fs.readFileSync('sw.js', 'utf8');
  const swProcessed = swSource.replace(/__BUILD_VERSION__/g, buildVersion);
  fs.writeFileSync('public/sw.js', swProcessed);
  console.log('  📄 Copied sw.js → public/sw.js (cache: huddledin-' + buildVersion + ')');
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

const builds = [
  esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: 'public/app.bundle.js',
    format: 'iife',
    globalName: 'HuddledinModules',
    minify: true,
    sourcemap: true,
    target: 'es2020',
    loader: { '.css': 'text' },
  }).then(() => {
    console.log('\n✅ Module build complete → public/app.bundle.js');
  }),
];

const parserEntry = 'src/features/reports/file-parser.js';
if (fs.existsSync(parserEntry)) {
  builds.push(
    esbuild.build({
      entryPoints: [parserEntry],
      bundle: true,
      outfile: 'public/file-parser.bundle.js',
      format: 'iife',
      globalName: 'HuddledinFileParser',
      minify: true,
      sourcemap: true,
      target: 'es2020',
    }).then(() => {
      console.log('✅ File parser build complete → public/file-parser.bundle.js');
    })
  );
}

// Tiptap report-builder bundle — lazy-loaded via <script> injection at runtime.
// Mirrors file-parser pattern. Splits ~100-150 KB gzipped of Tiptap+ProseMirror
// off the parent's app.bundle.js boot path. Closes audit Report 05 #1.
const tiptapEntry = 'src/features/reports/tiptap-entry.js';
if (fs.existsSync(tiptapEntry)) {
  builds.push(
    esbuild.build({
      entryPoints: [tiptapEntry],
      bundle: true,
      outfile: 'public/tiptap.bundle.js',
      format: 'iife',
      globalName: 'HuddledinTiptap',
      minify: true,
      sourcemap: true,
      target: 'es2020',
      loader: { '.css': 'text' },
    }).then(() => {
      console.log('✅ Tiptap build complete → public/tiptap.bundle.js');
    })
  );
}

Promise.all(builds).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
