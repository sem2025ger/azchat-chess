const https = require('https');
const fs = require('fs');
const path = require('path');

const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const baseUrl = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/';
const destDir = path.join(__dirname, 'public', 'chess-assets', 'pieces', 'cburnett');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  for (const p of pieces) {
    const url = `${baseUrl}${p}.svg`;
    const dest = path.join(destDir, `${p}.svg`);
    await download(url, dest);
    console.log(`Downloaded ${p}.svg`);
  }
}

main().catch(console.error);
