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

## Component: Stockfish.js 19 Lite Single (analysis engine)
- **Release**: v19.0.1
- **Files staged during frontend build**: `stockfish-19-lite-single.js`, `stockfish-19-lite-single.wasm`
- **Source**: https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1
- **Upstream Stockfish source**: https://github.com/official-stockfish/Stockfish
- **License**: GNU General Public License version 3 (GPL-3.0); retain notices and provide corresponding source to satisfy redistribution obligations.
- **Corresponding source**: release commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`, https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.tar.gz . Its README and build scripts document Emscripten 6.0.9 and the Lite Single build, including required network retrieval.
- **Public notice**: `/stockfish-19-notice.html` is shipped alongside the binaries and linked from the analysis engine label. `/stockfish-license.txt` supplies the GPL text. Original engine notices remain untouched.
- **Integrity**: `tmp/scripts/prepare-stockfish19.mjs` verifies sizes and SHA-256 values pinned in git; mutable release metadata cannot approve replacement binaries.
  - JS: `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a`
  - WASM: `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de`
- **Release gate**: maintain availability of the exact corresponding source for as long as redistribution requires it; check the published notice/source links before production. Full application licensing and source rebuild reproducibility have not been certified by this engineering review.
- **Previous assets**: Stockfish.js 18 stays in the repository for rollback; the analysis worker references 19 only in this feature branch.
