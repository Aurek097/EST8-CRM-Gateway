import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPublicDir = path.join(rootDir, ".output", "public");
const distDir = path.join(rootDir, "dist");

if (!fs.existsSync(outputPublicDir)) {
  console.error("No .output/public directory found. Run vite build first.");
  process.exit(1);
}

// Ensure dist directory exists
fs.mkdirSync(distDir, { recursive: true });

// Copy all files from .output/public to dist
fs.cpSync(outputPublicDir, distDir, { recursive: true });

// Find index-*.js and styles-*.css in dist/assets
const assetsDir = path.join(distDir, "assets");
const assetFiles = fs.readdirSync(assetsDir);
const jsBundle = assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const cssBundle = assetFiles.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!jsBundle) {
  console.warn("Could not find index-*.js bundle in assets");
}

const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EST8 CallDesk</title>
    <meta name="description" content="Phone-sales workspace and CRM for life insurance agents." />
    <meta property="og:title" content="EST8 CallDesk" />
    <meta property="og:description" content="Phone-sales workspace and CRM for life insurance agents." />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
    />
    ${cssBundle ? `<link rel="stylesheet" href="/assets/${cssBundle}" />` : ""}
    ${jsBundle ? `<script type="module" src="/assets/${jsBundle}"></script>` : ""}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

// Write index.html to dist
fs.writeFileSync(path.join(distDir, "index.html"), htmlTemplate);
// Also write 200.html and 404.html for SPA routing on static hosts
fs.writeFileSync(path.join(distDir, "200.html"), htmlTemplate);
fs.writeFileSync(path.join(distDir, "404.html"), htmlTemplate);

console.log("Successfully prepared dist directory for publication with bundle:", jsBundle);
