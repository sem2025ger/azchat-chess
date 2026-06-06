# Deployment Documentation

## 1. Production Frontend Domain
https://chessaz.de

## 2. Vercel Frontend Project
azchat-chess

## 3. Vercel Production Environment Variables
`VITE_SERVER_URL=https://chessaz-api.onrender.com`

## 4. Render Backend Service
chessaz-api

## 5. Render Backend URL
https://chessaz-api.onrender.com

## 6. Backend Health Check
URL: https://chessaz-api.onrender.com/health
Expected response:
```json
{"ok":true,"service":"aztr-chess-server"}
```

## 7. Render Backend Environment Variables
`FRONTEND_URL=https://chessaz.de`

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
