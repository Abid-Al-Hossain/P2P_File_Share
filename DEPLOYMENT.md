# Deployment Guide

Deploy your P2P File Share app for **free** so anyone worldwide can use it!

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Vercel (Free)  │     │  Render (Free)  │
│    Frontend     │────▶│ Signaling Server│
│   (React App)   │     │   (Socket.IO)   │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              WebRTC P2P
         (Direct file transfer)
```

## Step 1: Deploy Signaling Server (Render.com)

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo: `Abid-Al-Hossain/P2P_File_Share`
4. Configure:
   - **Name**: `p2p-signaling-server`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free
5. Click **"Create Web Service"**
6. Wait for deployment (~2-3 minutes)
7. Copy your URL: `https://p2p-signaling-server-xxxx.onrender.com`

## Step 2: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up (free)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repo: `Abid-Al-Hossain/P2P_File_Share`
4. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
5. Add Environment Variable:
   - **Name**: `VITE_SIGNALING_URL`
   - **Value**: `https://p2p-signaling-server-xxxx.onrender.com` (your Render URL)
6. Click **"Deploy"**
7. Your app is live at: `https://your-app.vercel.app`

## Step 3: Test It!

1. Open your Vercel URL in one browser
2. Select files and copy the share link
3. Send the link to a friend anywhere in the world
4. They open the link and download directly from your browser!

## How It Works

| What                         | Where      | Cost                  |
| ---------------------------- | ---------- | --------------------- |
| Signaling (connection setup) | Render.com | Free                  |
| Website UI                   | Vercel     | Free                  |
| Actual file data             | Direct P2P | Free (your bandwidth) |

## Troubleshooting

| Issue                   | Solution                                          |
| ----------------------- | ------------------------------------------------- |
| "Connecting..." forever | Check signaling server is running on Render       |
| Slow transfer           | P2P speed depends on both peers' internet         |
| Connection drops        | WebRTC may fail behind strict corporate firewalls |

## Notes

- **Free tier limits**: Render free tier sleeps after 15 mins of inactivity (first request takes 30s to wake up)
- **HTTPS required**: Both services provide free SSL certificates
- **No file limits**: Files go directly between browsers, no server storage
