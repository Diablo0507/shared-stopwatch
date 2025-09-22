// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ---- 状態（グローバルに一意。重複宣言を避ける） ----
const roomState = Object.create(null);
const initial = () => ({ isRunning: false, startAt: null, offsetMs: 0 });

const app = express();
app.use(express.static('public'));

// 動作確認用
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on('connection', (socket) => {
  console.log('[socket] connected', socket.id);

  socket.on('join', ({ roomId }) => {
    console.log('[socket] join', roomId);
    if (!roomId) return;
    socket.join(roomId);
    if (!roomState[roomId]) roomState[roomId] = initial();

    socket.emit('state', {
      serverNow: Date.now(),
      ...roomState[roomId],
    });
  });

  socket.on('control', ({ roomId, action, value }) => {
    console.log('[socket] control', { roomId, action, value });
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
      case 'add':
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

  socket.on('disconnect', () => {
    console.log('[socket] disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000; // Renderが注入するPORTを優先
server.listen(PORT, () => {
  console.log(`Shared Stopwatch listening on ${PORT}`);
});
