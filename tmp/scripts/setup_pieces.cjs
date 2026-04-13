const fs = require('fs');
const path = require('path');

// ONLY classic for now as requested
const themes = ['classic'];
const pieces = ['K', 'Q', 'R', 'B', 'N', 'P'];
const colors = ['w', 'b'];

/**
 * Premium Staunton-style SVG paths
 * Optimized for professional recognition.
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

  switch (theme) {
    case 'classic':
      return {
        fill: isWhite ? '#ffffff' : '#454545',
        stroke: isWhite ? '#999999' : '#1a1a1a',
        strokeWidth: '1.5',
        defs: isWhite ? `<filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.8" /><feOffset dx="0.5" dy="0.5" result="offsetblur" /><feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>` : '',
        extraAttr: isWhite ? 'filter="url(#soft-shadow)"' : ''
      };
    default:
      return { fill: isWhite ? '#ffffff' : '#000000', stroke: isWhite ? '#000000' : '#ffffff', strokeWidth: '1', extraAttr: '' };
  }
};

const setupPieces = () => {
  themes.forEach(theme => {
    const dir = path.join(process.cwd(), 'public', 'pieces', theme);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    colors.forEach(color => {
      pieces.forEach(type => {
        const style = getStyles(theme, color);
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <defs>${style.defs || ''}</defs>
  <g fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${style.extraAttr || ''}>
    <path d="${paths[type]}" />
  </g>
</svg>`;
        const fileName = `${color}${type}.svg`;
        fs.writeFileSync(path.join(dir, fileName), svg);
      });
    });
  });
  console.log('Successfully generated classic chess pieces with improved visual quality.');
};

setupPieces();
