# Mobile Merida piece styles

**Mobile only** (viewport under 768px). Two sets of twelve SVGs for all six white and six black chess pieces:

- `neo/` = **Merida Flat**, high-contrast variant with flat highlights, intended to match the clean classic style shown in the user's Chess.com reference without copying Chess.com assets.
- `tournament/` = **Merida Classic**, original Lichess Merida artwork with its subtle gradient highlights, intended to match the traditional chess-software look shown in the Schach.de reference.

**Author:** Armando Hernandez Marroquin.  
**Source:** https://github.com/lichess-org/lila/tree/1c94e9e8d4615147df5da8a9d3b65f54991c7169/public/piece/merida  
**License:** GNU GPL version 2 or later (GPLv2+); see `LICENSE-GPL-2.0-or-later.txt` and `tmp/ASSET_LICENSES.md`.  
The original and modified SVG sources are the SVG files themselves.

No Chess.com or Schach.de files were copied or downloaded. Desktop rendering and the existing desktop SVG files remain unchanged. React `<picture><source media="(max-width: 767px)">` in `ChessBoard.tsx` selects mobile assets, while mobile-only Settings previews use the same paths. Existing persisted theme IDs `neo` and `tournament` are retained.
