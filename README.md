# P2P File Share

A browser-based peer-to-peer file sharing application that allows direct file transfers between browsers without storing files on a server.

![P2P File Share Demo](https://img.shields.io/badge/Status-Active-brightgreen)

## Features

- **Direct P2P Transfer**: Files are sent directly between browsers using WebRTC
- **No Server Storage**: Files never touch the server, only signaling data is exchanged
- **Folder Support**: Upload and download entire folders with preserved structure
- **Large File Support**: Chunked transfer with flow control handles files of any size
- **Progress Tracking**: Real-time progress indicators for each file
- **Cross-Platform**: Works on any modern browser (Chrome/Edge recommended)

## Tech Stack

| Component | Technology                |
| --------- | ------------------------- |
| Frontend  | React + Vite + TypeScript |
| Styling   | Tailwind CSS v4           |
| Backend   | Node.js + Express         |
| Signaling | Socket.IO                 |
| P2P       | simple-peer (WebRTC)      |

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Modern browser (Chrome/Edge recommended for File System Access API)

### Installation

```bash
# Clone the repository
git clone https://github.com/Abid-Al-Hossain/P2P_File_Share.git
cd P2P_File_Share

# Install all dependencies
npm run install:all
```

### Running the Application

```bash
# Start both server and client
npm run dev
```

This starts:

- **Signaling Server**: http://localhost:3000
- **Client**: http://localhost:5173

## How to Use

### Sending Files

1. Open http://localhost:5173
2. Drag & drop files/folders or click to select
3. Copy the generated share link
4. Send the link to the receiver

### Receiving Files

1. Open the share link in a browser
2. Wait for connection (file list appears)
3. Click "Download All"
4. Select a folder to save files (or use browser download)

## Project Structure

```
P2P_File_Share/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── SenderView.tsx
│   │   │   ├── ReceiverView.tsx
│   │   │   └── FilePicker.tsx
│   │   ├── lib/
│   │   │   └── p2p.ts      # WebRTC client
│   │   └── App.tsx
│   └── package.json
├── server/                 # Signaling server
│   ├── index.js
│   └── package.json
└── package.json            # Root scripts
```

## Architecture

```
┌──────────────┐     Signaling      ┌──────────────┐
│    Sender    │◄──────────────────►│   Receiver   │
│   Browser    │    (Socket.IO)     │   Browser    │
└──────┬───────┘                    └───────┬──────┘
       │                                    │
       │         WebRTC Data Channel        │
       └────────────────────────────────────┘
                  (Direct P2P)
```

## Troubleshooting

| Issue            | Solution                                                    |
| ---------------- | ----------------------------------------------------------- |
| Connection stuck | Check console for errors, ensure both peers on same network |
| Firewall issues  | Allow ports 3000 and 5173                                   |
| Download fails   | Try Chrome/Edge for best File System API support            |

## License

MIT

## Author

[Abid-Al-Hossain](https://github.com/Abid-Al-Hossain)
