const fs = require('fs');
const path = require('path');

const themes = ['classic', 'neo', 'tournament', 'wood', 'glass', 'marble'];
const pieces = ['K', 'Q', 'R', 'B', 'N', 'P'];
const colors = ['w', 'b'];

/**
 * Premium Staunton-style SVG paths
 * Optimized for recognition and professional aesthetics.
 */
const paths = {
  K: 'M 22.5,11.63 V 6 M 20,8 h 5 M 22.5,25 s 4.5,-7.5 3,-10 c -1.5,-2.5 -6,-2.5 -6,0 0,2.5 3,10 3,10 z M 9,36 c 3.39,-0.47 8.5,-1.5 13.5,-1.5 5,0 10.11,1.03 13.5,1.5 1,0.14 1,2 0,2 -3.39,-0.47 -8.5,-1.5 -13.5,-1.5 -5,0 -10.11,1.03 -13.5,1.5 -1,0.14 -1,2 0,2 z M 11.5,30 c 3.5,-1 8,-1.5 11,-1.5 3,0 7.5,0.5 11,1.5 1.5,0.43 1.5,2 0,2 -3.39,-1 -8,-1.5 -11,-1.5 -3,0 -7.5,0.5 -11,1.5 -1.5,0.43 -1.5,2 0,2 z M 11.5,33 c 3.5,-1 8,-1.5 11,-1.5 3,0 7.5,0.5 11,1.5 1.5,0.43 1.5,2 0,2 -3.5,-1 -8,-1.5 -11,-1.5 -3,0 -7.5,0.5 -11,1.5 -1.5,0.43 -1.5,2 0,2 z',
  Q: 'M 9,26 c 8.5,-1.5 21,-1.5 27,0 l 2,-12 c -7,2.5 -18,2.5 -25,0 l -4,12 z M 9,26 c 0,2 1.5,2 2.5,4 1,2 1,1 1,1 H 31.5 c 0,0 0,1 1,-1 1,-2 2.5,-2 2.5,-4 M 11.5,30 c 3.5,-1 8,-1.5 11,-1.5 3,0 7.5,0.5 11,1.5 1.5,0.43 1.5,2 0,2 -3.5,-1 -8,-1.5 -11,-1.5 -3,0 -7.5,0.5 -11,1.5 -1.5,0.43 -1.5,2 0,2 z M 9,36 c 3.39,-0.47 8.5,-1.5 13.5,-1.5 5,0 10.11,1.03 13.5,1.5 1,0.14 1,2 0,2 -3.39,-0.47 -8.5,-1.5 -13.5,-1.5 -5,0 -10.11,1.03 -13.5,1.5 -1,0.14 -1,2 0,2 z',
  R: 'M 9,36 c 3.39,-0.47 8.5,-1.5 13.5,-1.5 5,0 10.11,1.03 13.5,1.5 1,0.14 1,2 0,2 -3.39,-0.47 -8.5,-1.5 -13.5,-1.5 -5,0 -10.11,1.03 -13.5,1.5 -1,0.14 -1,2 0,2 z M 11,14 V 9 h 4 v 2 h 5 V 9 h 5 v 2 h 5 V 9 h 4 v 5 M 12,14 l 1.5,12 h 18 L 33,14 H 12 z M 11,26 c 0,2 1.5,2 2.5,4 1,2 1,1 1,1 H 30.5 c 0,0 0,1 1,-1 1,-2 2.5,-2 2.5,-4',
  B: 'M 9,36 c 3.39,-0.47 8.5,-1.5 13.5,-1.5 5,0 10.11,1.03 13.5,1.5 1,0.14 1,2 0,2 -3.39,-0.47 -8.5,-1.5 -13.5,-1.5 -5,0 -10.11,1.03 -13.5,1.5 -1,0.14 -1,2 0,2 z M 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-2.5 -2.5,-4 -2.5,-4 5.5,-1.5 6,-11.5 -5,-15.5 -11,4 -10.5,14 -5,15.5 0,0 -2.5,1.5 -2.5,4 0,0 -0.5,0.5 0,2 z M 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z',
  N: 'M 22,10 c 10.5,1 16.5,8 16,21 -5,2 -5,-2 -5,-2 -9,5 -14.5,-1 -14.5,-1 1,3.5 -1,8 -1,8 -1,1 -1,1 h -5 c -1,0 -1,-1 -1,-1 0,-3 3,-9 3,-9 0,0 -4,1 -4,1 0,0 0,-15 12,-18 z M 24,18 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z',
  P: 'M 22.5,9 a 5,5 0 1 1 -10,0 5,5 0 1 1 10,0 z M 22.5,14 c -2.52,0 -5.35,0.54 -7,2.5 -1.65,1.96 -1,7.5 -1,7.5 0,0 2,2.5 2,5.5 v 0.5 c 0,0 0,0.5 -1,1 -1,0.5 -3.5,1.5 -3.5,2.5 0,1 1,2 1,2 3.39,-0.47 8.5,-1.5 13.5,-1.5 5,0 10.11,1.03 13.5,1.5 1,0.14 1,2 0,2 -3.39,-0.47 -8.5,-1.5 -13.5,-1.5 -5,0 -10.11,1.03 -13.5,1.5 -1,0.14 -1,2 0,2 z'
};

const getStyles = (theme, color) => {
  const isWhite = color === 'w';
  const mainColor = isWhite ? '#FFFFFF' : '#000000';
  const strokeColor = isWhite ? '#000000' : '#FFFFFF';

  switch (theme) {
    case 'classic':
      return { fill: mainColor, stroke: strokeColor, strokeWidth: isWhite ? '1.5' : '1.2' };
    case 'neo':
      return {
        fill: isWhite ? 'url(#grad-neo-w)' : 'url(#grad-neo-b)',
        stroke: isWhite ? '#222' : '#ddd',
        strokeWidth: '1',
        defs: `<linearGradient id="grad-neo-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#ddd"/></linearGradient><linearGradient id="grad-neo-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#444"/><stop offset="100%" stop-color="#111"/></linearGradient>`
      };
    case 'tournament':
      return { fill: mainColor, stroke: strokeColor, strokeWidth: '2.5' };
    case 'wood':
      return {
        fill: isWhite ? 'url(#grad-wood-w)' : 'url(#grad-wood-b)',
        stroke: isWhite ? '#5d3a1a' : '#2a1806',
        strokeWidth: '1.2',
        defs: `<linearGradient id="grad-wood-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eecd9d"/><stop offset="100%" stop-color="#b58863"/></linearGradient><linearGradient id="grad-wood-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8b4a1c"/><stop offset="100%" stop-color="#2a1806"/></linearGradient>`
      };
    case 'glass':
      return {
        fill: isWhite ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
        stroke: isWhite ? '#8fffff' : '#ffffff',
        strokeWidth: '1.5',
        defs: `<radialGradient id="glass-shine" cx="30%" cy="30%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity="0.8"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
        extra: `<circle cx="15" cy="15" r="10" fill="url(#glass-shine)" opacity="0.3"/>`
      };
    case 'marble':
      return {
        fill: isWhite ? 'url(#grad-marble-w)' : 'url(#grad-marble-b)',
        stroke: '#888',
        strokeWidth: '0.8',
        defs: `<linearGradient id="grad-marble-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff"/><stop offset="30%" stop-color="#eee"/><stop offset="70%" stop-color="#ddd"/><stop offset="100%" stop-color="#fff"/></linearGradient><linearGradient id="grad-marble-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#333"/><stop offset="50%" stop-color="#000"/><stop offset="100%" stop-color="#333"/></linearGradient>`
      };
    default:
      return { fill: mainColor, stroke: strokeColor, strokeWidth: '1' };
  }
};

const setupPieces = () => {
  themes.forEach(theme => {
    const dir = path.join(process.cwd(), 'public', 'pieces', theme);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    colors.forEach(color => {
      pieces.forEach(type => {
        const style = getStyles(theme, color);
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45"><defs>${style.defs || ''}</defs><g fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[type]}" />${style.extra || ''}</g></svg>`;
        const fileName = `${color}${type}.svg`;
        fs.writeFileSync(path.join(dir, fileName), svg);
      });
    });
  });
  console.log('Successfully generated 72 premium chess pieces across 6 themes.');
};

setupPieces();
