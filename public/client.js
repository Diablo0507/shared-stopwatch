// client.js
const $ = (sel) => document.querySelector(sel);
const roomInput = $('#roomId');
const joinBtn = $('#joinBtn');
const displayEl = $('#display');
const controls = $('#controls');
const increments = $('#increments');
const shareUrlEl = $('#shareUrl');
const modeHintEl = $('#modeHint');

const url = new URL(location.href);
const initialRoom = url.searchParams.get('room') || '';
const viewOnly = url.searchParams.get('view') === '1';
if (initialRoom) roomInput.value = initialRoom;

const socket = io();

// サーバ状態
let isRunning = false;
let startAt = null;   // server epoch ms
let offsetMs = 0;
let clockDiff = 0;    // serverNow - localNow

let rafId = null;

function fmt(ms) {
  const sign = ms < 0 ? '-' : '';
  ms = Math.abs(ms);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms3 = Math.floor(ms % 1000);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms3).padStart(3,'0')}`;
}

function render() {
  const nowLocal = Date.now();
  const base = isRunning ? (nowLocal + clockDiff - startAt) : 0;
  const elapsed = base + offsetMs;
  displayEl.textContent = fmt(elapsed);
  rafId = requestAnimationFrame(render);
}

function startRender() { if (rafId == null) rafId = requestAnimationFrame(render); }
function stopRender() { if (rafId != null) cancelAnimationFrame(rafId); rafId = null; }

function joinRoom(roomId) {
  if (!roomId) return;
  const next = new URL(location.href);
  next.searchParams.set('room', roomId);
  history.replaceState(null, '', next.toString());
  shareUrlEl.textContent = `このURLを共有： ${next.toString()}`;
  socket.emit('join', { roomId });
}

socket.on('state', (payload) => {
  if (!payload) return;
  const localNow = Date.now();
  clockDiff = payload.serverNow - localNow;
  isRunning = payload.isRunning;
  startAt = payload.startAt;
  offsetMs = payload.offsetMs;

  modeHintEl.textContent = viewOnly ? '閲覧専用モード（操作は無効）' : '操作可能モード（操作は全員に同期）';
  startRender();
});

// コマンド送信
function sendControl(action, extra = {}) {
  if (viewOnly) return; // 閲覧専用
  const roomId = roomInput.value.trim();
  if (!roomId) return;
  socket.emit('control', { roomId, action, ...extra });
}

// UIイベント
controls.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  sendControl(btn.getAttribute('data-act'));
});

increments.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-add]');
  if (!btn) return;
  const ms = parseInt(btn.getAttribute('data-add'), 10) || 0;
  sendControl('add', { value: ms });
});

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value.trim();
  joinRoom(roomId);
});

roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// 自動入室
if (initialRoom) joinRoom(initialRoom);

// 閲覧専用ならボタンを無効化
if (viewOnly) {
  [...document.querySelectorAll('button')].forEach(b => b.disabled = true);
}
