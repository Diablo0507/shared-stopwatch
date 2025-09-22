// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

/** 各部屋の状態を保持（必要なら後でRedis等に置き換え） */
const roomState = Object.create(null);
const initial = () => ({ isRunning: false, startAt: null, offsetMs: 0 });

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on('connection', (socket) => {
  socket.on('join', ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    if (!roomState[roomId]) roomState[roomId] = initial();

    socket.emit('state', {
      serverNow: Date.now(),
      ...roomState[roomId],
    });
  });

  socket.on('control', ({ roomId, action, value }) => {
    if (!roomId || !roomState[roomId]) return;
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
      case 'add': // ms単位で加算（動作中/停止中どちらでもOK）
        s.offsetMs += (typeof value === 'number' ? value : 0);
        break;
      default:
        return;
    }

    io.to(roomId).emit('state', {
      serverNow: now,
      ...roomState[roomId],
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Shared Stopwatch: http://localhost:${PORT}`);
});
