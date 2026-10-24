# Third-Party Licenses

## Component: Stockfish.js 18 Lite Single
- **Release**: v18.0.0
- **Bundled files**:
  - `stockfish-18-lite-single.js`
  - `stockfish-18-lite-single.wasm`
- **Attribution**: Stockfish.js © 2026 Chess.com, LLC and contributors
- **License**: GNU General Public License version 3
- **Official repository**: https://github.com/nmrugg/stockfish.js
- **Exact release**: https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0
- **Upstream Stockfish source**: https://github.com/official-stockfish/Stockfish
- **Statement**: The bundled JavaScript and WebAssembly files are unmodified official v18.0.0 release assets.
- **Recorded SHA-256 values**:
  - **JS**: 2278005057F381491F1C9BB3E44C9F5920B3A00BEF9759E33CC6582769A1F1FE
  - **WASM**: A8FBC05EC6920B56D7485826DCB02C5FFD2826BCBF751CF973046F237A9096F1

## Component: Stockfish.js 19 Lite Single (production engine upgrade)
- **Upstream release**: v19.0.1 (Stockfish 19 compiled to browser WebAssembly)
- **Build variant**: lite, single-threaded (real Stockfish 19, smaller NNUE, not Full)
- **Distribution files**: `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm` (generated under `tmp/public/` at build time)
- **Attribution**: Stockfish developers; stockfish.js by Nathan Rugg, Chess.com, LLC and contributors
- **License**: GNU GPL v3; the existing `tmp/public/stockfish-license.txt` contains the license text
- **Exact upstream source**: https://github.com/nmrugg/stockfish.js/tree/v19.0.1
- **Release binaries**: https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1
- **Upstream Stockfish 19**: https://github.com/official-stockfish/Stockfish/releases/tag/sf_19
- **Statement**: The published release binaries are downloaded at build time, verified byte-for-byte using the official release SHA-256 digests and served unmodified from ChessAZ. Stockfish 18 assets are retained for rollback.
- **SHA-256 JS**: ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a
- **SHA-256 WASM**: ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de
