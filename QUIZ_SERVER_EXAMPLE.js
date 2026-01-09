/**
 * SmartSocket Quiz Server - Complete Working Example
 * Shows how to properly implement broadcasting for a quiz application
 * 
 * IMPORTANT: This is the CORRECT way to use broadcasting!
 * Your server must call namespace.emit() or server.to(room).emit()
 * in your event handlers to broadcast to clients.
 */

import SmartSocket from './smartsocket/index.js';

const server = new SmartSocket(3000, {
  enableNamespaces: true,
  enableEncryption: false
});

// Create quiz namespace
const quizNS = server.namespace('/quiz');

// ==========================================
// QUIZ ROOM MANAGEMENT
// ==========================================
const quizRooms = new Map();

function getOrCreateRoom(quizCode) {
  if (!quizRooms.has(quizCode)) {
    quizRooms.set(quizCode, {
      code: quizCode,
      players: [],
      currentQuestion: null,
      leaderboard: [],
      status: 'waiting',
      createdAt: Date.now()
    });
  }
  return quizRooms.get(quizCode);
}

// ==========================================
// EVENT HANDLERS WITH PROPER BROADCASTING
// ==========================================

/**
 * When a client connects to /quiz namespace
 */
quizNS.on('connected', (socket) => {
  console.log(`[Quiz] Player connected: ${socket.id}`);
});

/**
 * EXAMPLE 1: Player joins a quiz
 * THIS is what's missing from your current implementation!
 */
quizNS.on('player-joined', (socket, data, ack) => {
  const { quizCode, playerId, playerName } = data;
  
  console.log(`[Quiz] Player joining: ${playerName} (${playerId}) to quiz ${quizCode}`);
  
  // Store player data in socket
  socket.data.quizCode = quizCode;
  socket.data.playerId = playerId;
  socket.data.playerName = playerName;
  socket.data.score = 0;
  
  // Add player to quiz room
  socket.join(quizCode);  // This joins the room in SmartSocket
  const room = getOrCreateRoom(quizCode);
  room.players.push({
    id: playerId,
    name: playerName,
    socketId: socket.id,
    score: 0
  });
  
  // ===== THIS IS THE IMPORTANT PART =====
  // Broadcast to all players in the quiz room
  // This tells other players that a new player joined
  quizNS.to(quizCode).emit('player-joined', {
    playerId,
    playerName,
    totalPlayers: room.players.length,
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
  });
  // ===== END BROADCAST =====
  
  ack({ success: true, message: `${playerName} joined the quiz` });
});

/**
 * EXAMPLE 2: Send new question to all players
 */
quizNS.on('start-quiz', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  const room = getOrCreateRoom(quizCode);
  
  const question = {
    id: 1,
    text: data.text,
    options: data.options,
    timeLimit: 30,
    timestamp: Date.now()
  };
  
  room.currentQuestion = question;
  
  // Broadcast question to ALL players in this quiz
  quizNS.to(quizCode).emit('new-question', {
    questionId: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit
  });
  
  console.log(`[Quiz] Broadcasting new question to room ${quizCode}`);
  ack({ success: true });
});

/**
 * EXAMPLE 3: Player submits answer - broadcast leaderboard
 */
quizNS.on('submit-answer', (socket, data, ack) => {
  const { quizCode, playerId, answer, timeUsed } = data;
  const room = getOrCreateRoom(quizCode);
  
  console.log(`[Quiz] ${playerId} answered: ${answer}`);
  
  // Calculate score
  const isCorrect = answer === room.currentQuestion?.correctAnswer;
  const score = isCorrect ? Math.max(0, 100 - timeUsed) : 0;
  
  // Update player score
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.score += score;
  }
  
  // Send private response to this player
  server.to(socket.id).emit('answer-result', {
    correct: isCorrect,
    earnedScore: score
  });
  
  // Broadcast updated leaderboard to ALL players
  const leaderboard = room.players
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      score: p.score,
      isCurrentPlayer: p.id === playerId
    }));
  
  quizNS.to(quizCode).emit('leaderboard-updated', {
    leaderboard,
    currentScore: player?.score || 0
  });
  
  console.log(`[Quiz] Broadcasting leaderboard to ${quizCode}`);
  ack({ success: true });
});

/**
 * EXAMPLE 4: Game over - notify all
 */
quizNS.on('quiz-finished', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  const room = getOrCreateRoom(quizCode);
  
  // Broadcast game over to all players in the room
  quizNS.to(quizCode).emit('game-over', {
    winner: room.players[0],
    finalLeaderboard: room.players.sort((a, b) => b.score - a.score),
    message: 'Quiz finished! Thanks for playing!'
  });
  
  console.log(`[Quiz] Quiz finished, broadcasting game-over to ${quizCode}`);
  ack({ success: true });
});

/**
 * EXAMPLE 5: Real-time status updates
 * Broadcast to everyone what's happening
 */
quizNS.on('status-update', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  
  // Broadcast status to everyone in the quiz
  quizNS.to(quizCode).emit('status', {
    status: data.status,
    message: data.message,
    timestamp: Date.now()
  });
  
  ack({ success: true });
});

/**
 * When player disconnects
 */
quizNS.on('disconnected', (socket) => {
  const quizCode = socket.data.quizCode;
  const room = getOrCreateRoom(quizCode);
  
  // Remove player
  room.players = room.players.filter(p => p.socketId !== socket.id);
  
  // Broadcast that player left
  quizNS.to(quizCode).emit('player-left', {
    playerName: socket.data.playerName,
    remainingPlayers: room.players.length
  });
  
  console.log(`[Quiz] Player ${socket.data.playerName} disconnected from quiz ${quizCode}`);
});

// ==========================================
// ADMIN ENDPOINTS (for testing)
// ==========================================

// Get quiz status
server.on('get-quiz-status', (socket, data, ack) => {
  const quizCode = data.quizCode;
  const room = quizRooms.get(quizCode);
  
  ack({
    room: room ? {
      code: room.code,
      players: room.players.length,
      status: room.status,
      createdAt: new Date(room.createdAt).toISOString()
    } : null
  });
});

// ==========================================
// START SERVER
// ==========================================

server.start();
console.log('✅ Quiz Server started on port 3000 with /quiz namespace');
console.log('\n📋 Broadcasting methods available:');
console.log('  • quizNS.emit(event, data)           - Broadcast to all in namespace');
console.log('  • quizNS.to(room).emit(event, data)  - Broadcast to specific room');
console.log('  • server.to(socketId).emit(...)      - Send to specific socket');
console.log('\n✨ Key points:');
console.log('  1. Always call .emit() in event handlers to broadcast');
console.log('  2. Use .to(room) for room-specific broadcasts');
console.log('  3. socket.join(room) first to add client to room');
console.log('  4. Broadcasts are ASYNC - check console for [BROADCAST] logs\n');
