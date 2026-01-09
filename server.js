import SmartSocket from './index.js';

const server = new SmartSocket({
  port: 8080,
  enableNamespaces: true,
  secure: false, // Set to true with SSL cert/key for production
});

// Initialize quiz namespace
const quizNS = server.namespace('/quiz');

/**
 * ROOM MANAGEMENT
 * When a client joins a quiz, add them to the room using socket.join()
 */
quizNS.on('join-quiz', (socket, data) => {
  const { quizCode, playerId, playerName } = data;
  
  // Add socket to quiz room
  socket.join(quizCode);
  
  console.log(`[QUIZ] ${playerName} (${playerId}) joined quiz: ${quizCode}`);
  console.log(`[QUIZ] Room "${quizCode}" now has ${socket.server.rooms.get(quizCode)?.size || 0} players`);
  
  // Broadcast player joined to all in room
  quizNS.to(quizCode).emit('player-joined', {
    quizCode,
    playerId,
    playerName,
    timestamp: Date.now()
  });
});

/**
 * AUTO-BROADCAST HANDLERS
 * Each event from a client is automatically broadcast to all clients in the same quiz room
 */

// Player joined event
quizNS.on('player-joined', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] player-joined in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('player-joined', data);
});

// Quiz started
quizNS.on('quiz-started', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] quiz-started in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('quiz-started', data);
});

// Timer started
quizNS.on('timer-start', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] timer-start in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('timer-start', data);
});

// Next question
quizNS.on('next-question', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] next-question in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('next-question', data);
});

// Player answered
quizNS.on('player-answered', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] player-answered in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('player-answered', data);
});

// Skip question
quizNS.on('skip-question', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] skip-question in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('skip-question', data);
});

// Show answer
quizNS.on('show-answer', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] show-answer in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('show-answer', data);
});

// End quiz
quizNS.on('end-quiz', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] end-quiz in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('end-quiz', data);
});

// Show results
quizNS.on('show-results', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] show-results in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('show-results', data);
});

/**
 * DATA REQUESTS (responds to requester only, not broadcast)
 */

// Get players in room
quizNS.on('get-players', (socket, data) => {
  const { quizCode } = data;
  const room = socket.server.rooms.get(quizCode);
  const playerCount = room ? room.size : 0;
  
  console.log(`[DATA] Sent player count (${playerCount}) for quiz ${quizCode} to requestor`);
  
  // Send back to this socket only
  socket.emit('players-list', {
    quizCode,
    count: playerCount
  });
});

// Player presence (send to all in room)
quizNS.on('player-present', (socket, data) => {
  const { quizCode } = data;
  console.log(`[BROADCAST] player-present in quiz: ${quizCode}`);
  quizNS.to(quizCode).emit('player-present', data);
});

/**
 * SERVER INITIALIZATION
 */
server.on('connect', (socket) => {
  console.log(`[CONNECTION] Socket connected: ${socket.id}`);
  console.log(`[STATS] Total connections: ${server.sockets.size}`);
});

server.on('disconnect', (socket) => {
  console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
  
  // Leave all quiz rooms
  if (socket.rooms && socket.rooms.size > 0) {
    socket.rooms.forEach(room => {
      socket.leave(room);
      console.log(`[QUIT] Socket left room: ${room}`);
    });
  }
  
  console.log(`[STATS] Total connections: ${server.sockets.size}`);
});

server.on('listen', (address, port) => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   SmartSocket Server - Quiz Relay      ║`);
  console.log(`╠════════════════════════════════════════╣`);
  console.log(`║ 🟢 Server running on port ${port}       ║`);
  console.log(`║ 📍 Address: ${address || 'localhost'}           ║`);
  console.log(`║ 📡 Namespace: /quiz                    ║`);
  console.log(`║ ✅ Auto-broadcast enabled              ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});

export default server;
