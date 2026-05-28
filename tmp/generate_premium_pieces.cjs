const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'public', 'pieces', 'classic');
const destDir = path.join(__dirname, 'public', 'pieces', 'premium');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);

files.forEach(file => {
  if (file.endsWith('.svg')) {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    
    // Scale down and translate to center
    // Find the first <g or add a wrap around everything inside <svg> ... </svg>
    // The SVGs are like: <svg ...><g ...>...</g></svg>
    content = content.replace(/<svg([^>]*)>(.*)<\/svg>/is, (match, svgAttrs, inner) => {
      // White pieces (w*.svg)
      if (file.startsWith('w')) {
        inner = inner.replace(/fill="#fff"/gi, 'fill="#f4f1e1"'); // Ivory
        inner = inner.replace(/stroke="#000"/gi, 'stroke="#2a2a2a"'); // Softer black stroke
      }
      // Black pieces (b*.svg)
      else if (file.startsWith('b')) {
        inner = inner.replace(/fill="#000"/gi, 'fill="#2c2c2e"'); // Matte graphite
        inner = inner.replace(/stroke="#000"/gi, 'stroke="#1a1a1c"');
        inner = inner.replace(/stroke="#ececec"/gi, 'stroke="#4a4a4c"'); // Inner lines
      }
      
      // Wrap with scale for miniature look
      // viewBox is 0 0 45 45. 
      // 45 * 0.85 = 38.25. (45 - 38.25) / 2 = 3.375
      const scaledInner = `<g transform="scale(0.85) translate(3.375, 3.375)">${inner}</g>`;
      
      return `<svg${svgAttrs}>${scaledInner}</svg>`;
    });

    fs.writeFileSync(path.join(destDir, file), content, 'utf8');
  }
});

console.log('Premium piece theme generated successfully.');
