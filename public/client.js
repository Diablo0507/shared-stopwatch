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
+// 追加：現在のroomを保持（再接続時に使う）
+let currentRoomId = (initialRoom || '').trim();

 let rafId = null;
@@
 function joinRoom(roomId) {
   if (!roomId) return;
+  currentRoomId = roomId;  // ← 再接続のため必ず保持
   const next = new URL(location.href);
   next.searchParams.set('room', roomId);
   history.replaceState(null, '', next.toString());
   shareUrlEl.textContent = `このURLを共有： ${next.toString()}`;
   socket.emit('join', { roomId });
 }
 
+// 追加：接続（初回/再接続）したら自動で同じroomにjoinし直す
+socket.on('connect', () => {
+  if (currentRoomId) {
+    socket.emit('join', { roomId: currentRoomId });
+  }
+  if (!viewOnly) {
+    document.querySelectorAll('button').forEach(b => (b.disabled = false));
+  }
+  modeHintEl.textContent = viewOnly
+    ? '閲覧専用モード（操作は無効）'
+    : '操作可能モード（接続中・同期されます）';
+});
+
+// 追加：切断中はボタンを無効化して誤操作を防止
+socket.on('disconnect', () => {
+  if (!viewOnly) {
+    document.querySelectorAll('button').forEach(b => (b.disabled = true));
+  }
+  modeHintEl.textContent = 'サーバ未接続（自動再接続を待機中…）';
+});
+
+// 追加：接続エラー時の表示（任意）
+socket.on('connect_error', () => {
+  modeHintEl.textContent = '接続エラー（再試行中…）';
+});
+
 socket.on('state', (payload) => {
   if (!payload) return;
   const localNow = Date.now();
   clockDiff = payload.serverNow - localNow;
   isRunning = payload.isRunning;
   startAt = payload.startAt;
   offsetMs = payload.offsetMs;
@@
 function sendControl(action, extra = {}) {
   if (viewOnly) return; // 閲覧専用
   const roomId = roomInput.value.trim();
   if (!roomId) return;
+  // 追加：未接続/未参加ガード
+  if (!socket.connected) return;
   socket.emit('control', { roomId, action, ...extra });
 }
@@
 // 自動入室
-if (initialRoom) joinRoom(initialRoom);
+if (initialRoom) joinRoom(initialRoom);
