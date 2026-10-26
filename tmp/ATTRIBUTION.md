# AZTR Chess Theme Asset Attribution

This document outlines the legal status and source of the visual assets used in the AZTR Chess application. 

### Statement of Originality and Proprietary Avoidance
**Important Legal Notice:** No assets, SVGs, PNGs, textures, CSS styles, branding, logos, or proprietary files were scraped, downloaded, or copied from Chess.com or any other proprietary chess platform. All board colors are implemented via standard CSS hex codes and gradients.

### Chess Piece Assets (`/public/pieces/`)
The visual pieces used in this project are local SVG files modeled on the standard "Staunton" design.

1. **Classic (`/classic`)** 
   - **Origin/Style:** Based on the standard Wikimedia Commons "cburnett" (Colin M.L. Burnett) / Merida chess sets.
   - **License:** Open Source / Creative Commons Attribution-ShareAlike (CC-BY-SA 3.0) or Public Domain (depending on the exact derivative in the repository). *License uncertain / needs verification for exact local files, but derived from standard open-source vectors.*
2. **Neo (`/neo`)**
   - **Origin/Style:** Modernized/minimalist Staunton-style vectors, provided as standard local fallback assets inside the project.
   - **License:** *License uncertain / needs verification.* Provided as standard fallback local assets. No external URLs or proprietary graphics were scraped.
3. **Tournament (`/tournament`)**
   - **Origin/Style:** Bold, high-contrast tournament-style local vectors.
   - **License:** *License uncertain / needs verification.* Provided as standard fallback local assets.
4. **Wood (`/wood`)**
   - **Origin/Style:** Texturized local vectors.
   - **License:** *License uncertain / needs verification.* Provided as standard fallback local assets.
5. **Glass (`/glass`)**
   - **Origin/Style:** Semi-transparent/modern local vectors.
   - **License:** *License uncertain / needs verification.* Provided as standard fallback local assets.
6. **Marble (`/marble`)**
   - **Origin/Style:** Stone-textured local vectors.
   - **License:** *License uncertain / needs verification.* Provided as standard fallback local assets.

### Board Themes
All board themes (e.g., *Classic Green*, *Premium Gold*, *Classic Wood*, *Dark*) are built entirely using CSS classes (TailwindCSS) defining hex color combinations for light and dark squares (e.g., `bg-[#ebecd0]`, `bg-[#739552]`). No proprietary textures or images are used for these standard boards.
