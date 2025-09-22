// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Redis } = require('@upstash/redis'); // 追加

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const roomState = Object.create(null);
const initial = () => ({ isRunning: false, startAt: null, offsetMs: 0 });

const app = express();
app.use(express.static('public'));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const key = (roomId) => `room:${roomId}`;

async function loadState(roomId) {
  try {
    const data = await redis.get(key(roomId));
    if (data && typeof data === 'object') return data;
  } catch {}
  return null;
}
async function saveState(roomId, state) {
  try { await redis.set(key(roomId), state); } catch {}
}

io.on('connection', (socket) => {
  socket.on('join', async ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);

    if (!roomState[roomId]) {
      const fromRedis = await loadState(roomId);
      roomState[roomId] = fromRedis || initial();
    }

    socket.emit('state', {
      serverNow: Date.now(),
      ...roomState[roomId],
    });
  });

  socket.on('control', async ({ roomId, action, value }) => {
    if (!roomId) return;
    if (!roomState[roomId]) roomState[roomId] = initial();

    const s = roomState[roomId];
    const now = Date.now();

    switch (action) {
      case 'start':
        if (!s.isRunning) { s.isRunning = true; s.startAt = now; }
        break;
      case 'pause':
        if (s.isRunning) {
          s.offsetMs += (now - s.startAt);
          s.isRunning = false;
          s.startAt = null;
        }
        break;
      case 'reset':
        roomState[roomId] = initial();
        break;
      case 'add':
        s.offsetMs += (typeof value === 'number' ? value : 0);
        break;
      default:
        return;
    }

    await saveState(roomId, roomState[roomId]); // 変更のたび保存

    io.to(roomId).emit('state', {
      serverNow: now,
      ...roomState[roomId],
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Shared Stopwatch listening on ${PORT}`);
});
