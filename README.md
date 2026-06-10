# 💎 SADEW-MD V2 — Premium WhatsApp Bot

<p align="center">
  <img src="https://files.catbox.moe/f18ceb.jpg" width="300"/>
</p>

## ✨ Features
- 🎬 Movie Hub (CineSubz, CineTV, Pirate, LakVision, Sayura Cinema & more)
- 📥 Downloader (YouTube, TikTok, Facebook, Mega, APK, GDrive)
- 🤖 AI Assistant & Tools
- 👥 Full Group Management
- 💎 Premium / Sudo user system
- 🔐 Anti-Delete, Anti-Link, Anti-Bad Words
- ⚡ Interactive Button Menus
- 🔄 Auto-reconnect on all platforms

## 🚀 Deploy

### Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Render
- Fork repo → New Web Service → set env vars

### GitHub Actions / Local
```bash
npm install
node index.js
```

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_ID` | ✅ | Base64 encoded creds.json OR MEGA link |
| `OWNER_NUMBER` | ✅ | Your WhatsApp number (no +) |
| `MONGODB_URI` | 💠 | MongoDB URL for DB features |
| `PREFIX` | 💠 | Command prefix (default: `.`) |
| `MODE` | 💠 | public/private/inbox/groups/premium |

## 📱 Get Session ID
```
.pair <your_number>
```
Then encode the downloaded `creds.json`:
```bash
base64 auth_info_baileys/creds.json
```
Set the output as `SESSION_ID` in your env.

## 💎 SADEW MD
> © 2026 SADEW-MD V2 | Premium Edition
