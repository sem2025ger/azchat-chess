# Deployment Documentation

## 1. Production Frontend Domain
https://chessaz.de

## 2. Vercel Frontend Project
azchat-chess

## 3. Vercel Production Environment Variables
`VITE_SERVER_URL=https://chessaz-api.onrender.com`

## 4. Render Backend Service
- **Service Name:** `chessaz-api`
- **Management Mode:** Manually created & managed Web Service via the Render Dashboard.
- **Repository Link:** Connected directly to GitHub repository `sem2025ger/azchat-chess` on branch `feat/full-production-hardening` (or `main` upon release).
- **Runtime:** Node.js
- **Root Directory:** `server`
- **Build Command:** `npm install`
- **Start Command:** `node index.js`

## 5. Render Backend URL
https://chessaz-api.onrender.com

## 6. Backend Health Check
URL: https://chessaz-api.onrender.com/health
Expected response:
```json
{"ok":true,"service":"aztr-chess-server"}
```

## 7. Render Backend Environment Variables
The following environment variables MUST be configured in the Render Dashboard under **Environment**:

| Variable | Required | Description / Example |
| :--- | :--- | :--- |
| `PORT` | Auto / 4000 | Port for HTTP/WebSocket server (Render automatically sets `PORT`, defaults to `4000` locally). |
| `FRONTEND_URL` | **Yes** | Origin allowed for CORS and Socket.IO handshake: `https://chessaz.de` |
| `SUPABASE_URL` | **Yes** | Supabase project URL (e.g., `https://xyzcompany.supabase.co`). |
| `SUPABASE_ANON_KEY` | **Yes** | Public/anon API key for Supabase client operations. |
| `SUPABASE_SERVICE_KEY` | **Yes** | Service role key for trusted backend operations (persisting match results, updating player ratings). **Never expose to frontend.** |

> [!CAUTION]
> **Render Blueprint (`render.yaml`) vs. Manual Service Ownership**
> - The live production service `chessaz-api` is managed **manually** in the Render dashboard.
> - `render.yaml` exists for Infrastructure-as-Code reference.
> - **Do NOT** trigger "New Blueprint Instance" on Render for this repo unless you intend to spin up a completely separate infrastructure stack. Doing so will create a duplicate service that lacks environment variables (since `sync: false` variables are not stored in Git), leading to runtime startup or authentication failures.
> - If migrating to Blueprint management in the future, the environment variables above must be explicitly transferred in the Render dashboard before redirecting DNS / frontend traffic.

## 8. DNS Configuration
- **Domain registrar/provider:** IONOS
- **Domain:** chessaz.de
- **A record** for `@` points to Vercel.
- Vercel shows `chessaz.de` as "Valid Configuration".

## 9. Production Verification Completed
- `chessaz.de` opens successfully
- two browser tabs can start a multiplayer game
- players receive different colors
- white and black moves sync both ways
- closing one tab shows "Opponent disconnected. Game over."
- New Game returns to play flow

## 10. Known Limitations
Render Free instance may spin down after inactivity, causing first request delay of around 30-60 seconds.
For real public usage, upgrade Render service to Starter or another always-on plan.

## Play with Friend / Private Room

The production site now supports private room games through the Play with Friend flow.

Verified production flow:

1. User opens:
   https://chessaz.de/play

2. User clicks:
   Play with Friend

3. Frontend emits:
   create_private_room

4. Backend creates a pending private room and returns:
   private_room_created { roomId }

5. Frontend shows a shareable link:
   https://chessaz.de/play?room=<roomId>

6. Friend opens the private room link.

7. Frontend reads the room query parameter and emits:
   join_private_room { roomId }

8. Backend adds the second player and emits the existing event to both players:
   match_found { roomId, color }

9. Both players enter:
   /game?roomId=<roomId>&color=<w|b>

10. Both players receive opposite colors.

11. Existing in-game Socket.IO protocol is reused:
   make_move
   update_board
   move_rejected
   game_over
   game_start

Production smoke-test passed:
- private room link worked from a cold/incognito tab
- both players entered the same game
- players received opposite colors
- moves synced both ways
- disconnect overlay worked
- normal random Start Game matchmaking still worked

## Known Limitation: In-Memory Room State

All room state is currently stored in backend memory on a single Render instance.

This includes:
- active games
- pending private rooms
- private room links
- random matchmaking rooms

Any backend restart, deploy, sleep/wake cycle, or crash drops all in-progress games and invalidates pending private room links.

This is acceptable for the current MVP.

Persisting live game state with Redis or another external state store is a future scaling step and is not required right now.
