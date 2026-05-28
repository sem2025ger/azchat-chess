const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'public', 'pieces', 'neo');
const destDir = path.join(__dirname, 'public', 'pieces', 'flat2d');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);

files.forEach(file => {
  if (file.endsWith('.svg')) {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    
    // Remove gradients
    content = content.replace(/<defs>[\s\S]*?<\/defs>/, '');

    // Replace fills and strokes for flat UI look
    if (file.startsWith('w')) {
      content = content.replace(/url\(#grad-neo-w\)/g, '#f8fafc'); // Very light slate/white
      content = content.replace(/stroke="[^"]+"/g, 'stroke="#94a3b8"'); // Slate 400
    } else if (file.startsWith('b')) {
      content = content.replace(/url\(#grad-neo-b\)/g, '#334155'); // Slate 700
      content = content.replace(/stroke="[^"]+"/g, 'stroke="#0f172a"'); // Slate 900
    }

    fs.writeFileSync(path.join(destDir, file), content, 'utf8');
  }
});

console.log('Flat 2D piece theme generated successfully.');
