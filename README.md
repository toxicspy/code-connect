# yoobro

Anonymous chat web app built with Vite, React, TypeScript, Tailwind, and Supabase.

## Local app

1. Install dependencies:

```sh
npm install
```

2. Create `.env` from `.env.example` and fill in your values.

3. Start the frontend:

```sh
npm run dev
```

## Calling feature

Voice and video calls use:
- WebRTC for peer-to-peer media
- Socket.io for signaling
- optional TURN credentials for privacy-safe relay

### Local signaling server

Run the signaling server in a second terminal:

```sh
npm run call:server
```

Default local signaling URL:

```txt
http://127.0.0.1:3001
```

Set this in `.env` for the frontend:

```txt
VITE_CALL_SIGNALING_URL="http://127.0.0.1:3001"
```

## Production deployment

The frontend can stay on Vercel, but the calling system needs a separate long-running Node host. Vercel alone is not enough for Socket.io signaling.

### Recommended setup

- Frontend: Vercel
- Signaling server: Render / Railway / Fly.io / VPS
- TURN server: required for strong privacy and reliable NAT traversal

### Render deployment

This repo includes [render.yaml](C:\Users\Gautham\Desktop\code connect\code-connect\render.yaml) for the signaling server.

Deploy the repo to Render, then set the frontend env:

```txt
VITE_CALL_SIGNALING_URL="https://your-render-service.onrender.com"
```

### TURN server env

For privacy-safe anonymous calling, set:

```txt
VITE_TURN_URL="turn:your-turn-server:3478"
VITE_TURN_USERNAME="your-turn-username"
VITE_TURN_CREDENTIAL="your-turn-password"
```

Without TURN, calls may still work through public STUN, but they are less reliable and do not meet the strongest privacy requirement.

## Current stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Supabase
- Socket.io
- WebRTC
