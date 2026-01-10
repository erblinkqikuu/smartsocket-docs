/**
 * SmartSocket Quiz Server - Auto Broadcasting (FIXED)
 * 
 * This server automatically broadcasts all quiz events to all players
 * in the same quiz room.
 * 
 * Features:
 * - Auto-broadcast to room
 * - Proper room management
 * - Event logging
 * - Error handling
 * - Fixed startup logging
 */

import SmartSocket from '../smartsocket/index.js';

// ============================================
// SERVER CONFIGURATION
// ============================================

const server = new SmartSocket({
  enableNamespaces: true,
  secure: false // Set to true with SSL for production
});

// ============================================
// STARTUP BANNER (Print immediately)
// ============================================

console.log(`
╔═══════════════════════════════════════════════╗
║      SmartSocket - Quiz Auto-Broadcasting    ║
╠═══════════════════════════════════════════════╣
║ ✅ Server started                             ║
║ 📍 Address: 0.0.0.0                          ║
║ 🔌 Port: 8080                                ║
║ 📡 Namespace: /quiz                           ║
║ 🔄 Auto-broadcast: ENABLED                    ║
║ 📊 Ready for simultaneous quizzes             ║
╚═══════════════════════════════════════════════╝
`);

// ============================================
// QUIZ NAMESPACE
// ============================================

// GUARD: Only create namespace once per server instance
let quizNS;
if (!server._quizNamespaceInitialized) {
  quizNS = server.namespace('/quiz');
  server._quizNamespaceInitialized = true;
} else {
  quizNS = server.namespaceManager.namespaces.get('/quiz');
}

// ============================================
// 1. ROOM MANAGEMENT - Add socket to room when joining
// ============================================

quizNS.on('join-quiz', (socket, data) => {
  const { quizCode, playerId, playerName } = data;
  
  if (!quizCode || !playerId) {
    console.error('[ERROR] join-quiz missing quizCode or playerId');
    return;
  }
  
  // Add socket to quiz room
  socket.join(quizCode);
  
  const roomSize = socket.server.rooms.get(quizCode)?.size || 0;
  console.log(`[QUIZ] ${playerName} (${playerId}) joined: ${quizCode} [Room Size: ${roomSize}]`);
  
  // Notify all in room that this player joined
  quizNS.to(quizCode).emit('player-joined', {
    quizCode,
    playerId,
    playerName,
    timestamp: Date.now()
  });
});

// ============================================
// 2. AUTO-BROADCAST HANDLERS
// ============================================
// Each of these handlers receives an event from a client
// and automatically broadcasts it to all other clients in the same room

/**
 * Host joined event
 * Data: { quizCode, hostId }
 */
quizNS.on('host-joined', (socket, data) => {
  if (!data.quizCode) return;
  const { quizCode, hostId } = data;
  
  // Add socket to quiz room
  socket.join(quizCode);
  
  const roomSize = socket.server.rooms.get(quizCode)?.size || 0;
  console.log(`[QUIZ] Host joined: ${quizCode} (${hostId}) [Room Size: ${roomSize}]`);
  
  // Broadcast to all in room
  console.log(`[BROADCAST] host-joined → ${quizCode}`);
  quizNS.to(quizCode).emit('host-joined', data);
});

/**
 * Player joined event
 * Data: { quizCode, playerId, playerName, timestamp }
 */
quizNS.on('player-joined', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] player-joined → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('player-joined', data);
});

/**
 * Quiz started event
 * Data: { quizCode, questions, projectMode }
 */
quizNS.on('quiz-started', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] quiz-started → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('quiz-started', data);
});

/**
 * Timer started event
 * Data: { quizCode, duration }
 */
quizNS.on('timer-start', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] timer-start → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('timer-start', data);
});

/**
 * Next question event
 * Data: { quizCode, questionIndex }
 */
quizNS.on('next-question', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] next-question → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('next-question', data);
});

/**
 * Player answered event
 * Data: { quizCode, playerId, answerIndex }
 */
quizNS.on('player-answered', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] player-answered → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('player-answered', data);
});

/**
 * Skip question event
 * Data: { quizCode, questionIndex }
 */
quizNS.on('skip-question', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] skip-question → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('skip-question', data);
});

/**
 * Show answer event
 * Data: { quizCode, questionIndex }
 */
quizNS.on('show-answer', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] show-answer → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('show-answer', data);
});

/**
 * End quiz event
 * Data: { quizCode }
 */
quizNS.on('end-quiz', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] end-quiz → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('end-quiz', data);
});

/**
 * Show results event
 * Data: { quizCode, results }
 */
quizNS.on('show-results', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] show-results → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('show-results', data);
});

/**
 * Player presence event
 * Data: { quizCode, playerId, playerName }
 */
quizNS.on('player-present', (socket, data) => {
  if (!data.quizCode) return;
  console.log(`[BROADCAST] player-present → ${data.quizCode}`);
  quizNS.to(data.quizCode).emit('player-present', data);
});

// ============================================
// 3. DATA REQUESTS (respond to single socket)
// ============================================

/**
 * Get players request - send back to requester only
 */
quizNS.on('get-players', (socket, data) => {
  if (!data.quizCode) return;
  const room = socket.server.rooms.get(data.quizCode);
  const playerCount = room ? room.size : 0;
  
  console.log(`[DATA] players-list for ${data.quizCode}: ${playerCount} players`);
  
  socket.emit('players-list', {
    quizCode: data.quizCode,
    count: playerCount
  });
});

// ============================================
// 4. SERVER EVENTS
// ============================================

server.on('connect', (socket) => {
  console.log(`[CONNECT] Socket: ${socket.id}`);
  console.log(`[STATS] Total connections: ${server.sockets.size}`);
});

server.on('disconnect', (socket) => {
  console.log(`[DISCONNECT] Socket: ${socket.id}`);
  
  // Clean up - leave all rooms
  if (socket.rooms && socket.rooms.size > 0) {
    socket.rooms.forEach(room => {
      socket.leave(room);
      const roomSize = socket.server.rooms.get(room)?.size || 0;
      console.log(`[QUIT] Left room [${room}] - Room size: ${roomSize}`);
    });
  }
  
  console.log(`[STATS] Total connections: ${server.sockets.size}`);
});

server.on('error', (err) => {
  console.error('[ERROR]', err.message);
  console.error('[STACK]', err.stack);
});

// ============================================
// START SERVER
// ============================================

server.listen(() => {
  console.log(`\n✅ SmartSocket listening on port 8080`);
  console.log(`📡 Registered namespaces: /, /quiz\n`);
});

export default server;
