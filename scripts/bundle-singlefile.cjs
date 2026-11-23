const fs = require('fs');
const path = require('path');

try {
  const distAssets = path.join(__dirname, '../dist/assets');
  if (!fs.existsSync(distAssets)) {
    console.error('dist/assets not found, build first');
    process.exit(1);
  }

  const files = fs.readdirSync(distAssets);
  const cssFile = files.find((f) => f.endsWith('.css'));
  const jsFile = files.find((f) => f.endsWith('.js'));

  if (!cssFile || !jsFile) {
    console.error('CSS or JS bundle missing in dist/assets');
    process.exit(1);
  }

  const css = fs.readFileSync(path.join(distAssets, cssFile), 'utf8');
  let js = fs.readFileSync(path.join(distAssets, jsFile), 'utf8');

  const publicDir = path.join(__dirname, '../public');

  // Replace import.meta.url with document.location.href so standard <script> works on file:// without module CORS issues
  js = js.split('import.meta.url').join('(typeof document!=="undefined"?document.location.href:"http://localhost/")');

  // Inline all uploaded Axiom Aegis brand emblem assets as base64 data URIs inside the standalone JS bundle
  const brandAssetPaths = [
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg',
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw_31b1850b.jpg',
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg',
  ];

  let faviconDataUri = '';
  const icon180Path = path.join(publicDir, 'icon-180.png');
  if (fs.existsSync(icon180Path)) {
    faviconDataUri = `data:image/png;base64,${fs.readFileSync(icon180Path).toString('base64')}`;
  }

  for (const relPath of brandAssetPaths) {
    const absPath = path.join(publicDir, relPath);
    if (fs.existsSync(absPath)) {
      const b64 = fs.readFileSync(absPath).toString('base64');
      const dataUri = `data:image/jpeg;base64,${b64}`;
      if (!faviconDataUri) {
        faviconDataUri = dataUri;
      }
      js = js.split(relPath).join(dataUri);
    }
  }

  // Escape any potential script closing tags in the minified js
  let safeJs = js.replace(/<\/script>/gi, '<\\/script>');

  let appVersion = 'v26.11.04';
  try {
    const versionFile = path.join(__dirname, '../src/utils/version.ts');
    if (fs.existsSync(versionFile)) {
      const vText = fs.readFileSync(versionFile, 'utf8');
      const dateMatch =
        vText.match(/LATEST_CHANGE_RELEASE_DATE\s*=\s*['"](\d{4})-(\d{1,2})-(\d{1,2})['"]/) ||
        vText.match(/CURRENT_RELEASE_DATE\s*=\s*['"](\d{4})-(\d{1,2})-(\d{1,2})['"]/);
      if (dateMatch) {
        const yy = Number(dateMatch[1]) % 100;
        const mm = Number(dateMatch[2]);
        const numDd = Number(dateMatch[3]);
        const iso = `${dateMatch[1]}-${String(mm).padStart(2, '0')}-${String(numDd).padStart(2, '0')}`;
        const dd = iso >= '2026-11-04' ? String(numDd).padStart(2, '0') : String(numDd);
        appVersion = `v${yy}.${mm}.${dd}`;
      } else {
        const vMatch = vText.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (vMatch && vMatch[1]) {
          appVersion = vMatch[1];
        }
      }
    }
  } catch {}

  // Ensure no legacy v1.x.x BETA / ALPHA strings remain in the bundled JS
  safeJs = safeJs.replace(/\bv1\.\d+\.\d+(?:\s*(?:BETA|ALPHA))?\b/gi, appVersion);

  const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Axiom Aegis (AA) — ${appVersion}</title>
    <meta name="description" content="Axiom Aegis (AA) ${appVersion} — Zero-cost, 100% offline-capable encrypted personal command center." />
    <meta name="theme-color" content="#000000" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Axiom Aegis" />
    ${faviconDataUri ? `<link rel="icon" type="image/png" sizes="180x180" href="${faviconDataUri}" />\n    <link rel="apple-touch-icon" sizes="180x180" href="${faviconDataUri}" />` : ''}
    <style>
${css}
    </style>
  </head>
  <body class="bg-[#000000] text-[#F8FAFC]">
    <div id="root"></div>
    <script>
window.__AXIOM_SINGLEFILE__=(typeof location!=="undefined"&&location.protocol==="file:");
${safeJs}
    </script>
  </body>
</html>`;

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'Axiom-Aegis.html'), html);
  fs.writeFileSync(path.join(publicDir, 'Axioms-Dailies.html'), html);

  const distDir = path.join(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'index.html'), html);
    fs.writeFileSync(path.join(distDir, 'Axiom-Aegis.html'), html);
    fs.writeFileSync(path.join(distDir, 'Axioms-Dailies.html'), html);

    for (const fileToCopy of ['_worker.js', '_routes.json', '_headers', 'sw.js', 'manifest.json']) {
      const srcFile = path.join(publicDir, fileToCopy);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(distDir, fileToCopy));
      }
    }

    // Remove any stale workbox files or manifest.webmanifest from previous builds
    for (const f of fs.readdirSync(distDir)) {
      if (f.startsWith('workbox-') || f === 'manifest.webmanifest') {
        try {
          fs.unlinkSync(path.join(distDir, f));
        } catch {}
      }
    }
  }

  console.log(
    'Successfully generated clean single-file bundle index.html / Axiom-Aegis.html ' +
      appVersion +
      ' (' +
      Math.round(html.length / 1024) +
      ' KB)'
  );
} catch (err) {
  console.error('Error generating standalone file:', err);
}
