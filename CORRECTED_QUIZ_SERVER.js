/**
 * CORRECTED QUIZ SERVER - With Proper Broadcasting
 * 
 * This is the FIXED version of your quiz server.
 * The key difference: It now BROADCASTS events to all players in the quiz room.
 * 
 * Replace your current quiz server with this code to fix the broadcasting issue.
 */

import SmartSocket from 'smartsocket';  // Or your import path

const server = new SmartSocket(3000, {
  enableNamespaces: true,
  enableEncryption: false  // Set to true for production with real encryption key
});

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

function getPlayerCount(quizCode) {
  const room = quizRooms.get(quizCode);
  return room ? room.players.length : 0;
}

// ==========================================
// ✅ FIXED EVENT HANDLER - WITH BROADCAST
// ==========================================

/**
 * THIS IS THE FIX: player-joined now broadcasts to all in the quiz room
 * 
 * Before (WRONG):
 *   quizNS.on('player-joined', (socket, data, ack) => {
 *     socket.data.quizCode = data.quizCode;
 *     ack({ success: true });  // ❌ Only sender gets this
 *   });
 * 
 * After (CORRECT):
 *   - Call socket.join(quizCode) to add to room
 *   - Call quizNS.to(quizCode).emit() to broadcast
 *   - Call ack() to acknowledge sender
 */
quizNS.on('player-joined', (socket, data, ack) => {
  const { quizCode, playerId, playerName } = data;
  
  console.log(`[Quiz] ${playerName} (${playerId}) joining quiz ${quizCode}`);
  
  // Step 1: Store player data in socket
  socket.data.quizCode = quizCode;
  socket.data.playerId = playerId;
  socket.data.playerName = playerName;
  socket.data.score = 0;
  
  // Step 2: Add socket to room (REQUIRED before broadcasting!)
  socket.join(quizCode);
  
  // Step 3: Add player to quiz room tracking
  const room = getOrCreateRoom(quizCode);
  room.players.push({
    id: playerId,
    name: playerName,
    socketId: socket.id,
    score: 0
  });
  
  // ✅ STEP 4: BROADCAST TO ALL IN THIS QUIZ ROOM
  // This is the missing line in your current code!
  quizNS.to(quizCode).emit('player-joined', {
    playerId,
    playerName,
    totalPlayers: room.players.length,
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
  });
  
  // Step 5: Acknowledge sender
  ack({ success: true, message: `${playerName} joined` });
  
  console.log(`[Quiz] Broadcasted player-joined to room ${quizCode}`);
});

// ==========================================
// Other Event Handlers (Also Fixed)
// ==========================================

/**
 * Start quiz - broadcast questions to all
 */
quizNS.on('start-quiz', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  const room = getOrCreateRoom(quizCode);
  
  const question = {
    id: data.questionId || 1,
    text: data.text,
    options: data.options,
    correctAnswer: data.correctAnswer,  // Don't send this to clients!
    timeLimit: 30
  };
  
  room.currentQuestion = question;
  
  // ✅ BROADCAST question to all players
  quizNS.to(quizCode).emit('new-question', {
    questionId: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit
    // ❌ Never send correctAnswer to clients!
  });
  
  ack({ success: true });
});

/**
 * Submit answer - broadcast leaderboard
 */
quizNS.on('submit-answer', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  const { playerId, answer } = data;
  const room = getOrCreateRoom(quizCode);
  
  console.log(`[Quiz] ${socket.data.playerName} answered: ${answer}`);
  
  // Check answer
  const isCorrect = answer === room.currentQuestion?.correctAnswer;
  const score = isCorrect ? 10 : 0;
  
  // Update player score
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.score += score;
  }
  
  // ✅ Send private result to this player only
  server.to(socket.id).emit('answer-result', {
    correct: isCorrect,
    earnedScore: score
  });
  
  // ✅ BROADCAST updated leaderboard to all
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
  
  ack({ success: true });
});

/**
 * Finish quiz - broadcast game over
 */
quizNS.on('quiz-finished', (socket, data, ack) => {
  const quizCode = socket.data.quizCode;
  const room = getOrCreateRoom(quizCode);
  
  room.status = 'finished';
  
  const finalLeaderboard = room.players.sort((a, b) => b.score - a.score);
  const winner = finalLeaderboard[0];
  
  // ✅ BROADCAST game over to all
  quizNS.to(quizCode).emit('game-over', {
    winner: winner ? { name: winner.name, score: winner.score } : null,
    finalLeaderboard: finalLeaderboard.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      score: p.score
    })),
    message: 'Quiz finished!'
  });
  
  ack({ success: true });
});

/**
 * Player disconnects - notify others
 */
quizNS.on('disconnected', (socket) => {
  const quizCode = socket.data.quizCode;
  const playerName = socket.data.playerName;
  const room = getOrCreateRoom(quizCode);
  
  if (quizCode && room) {
    // Remove player
    room.players = room.players.filter(p => p.socketId !== socket.id);
    
    // ✅ BROADCAST that player left
    quizNS.to(quizCode).emit('player-left', {
      playerName,
      remainingPlayers: room.players.length
    });
    
    console.log(`[Quiz] ${playerName} disconnected from quiz ${quizCode}`);
  }
});

// ==========================================
// START SERVER
// ==========================================

server.start();
console.log('✅ Quiz Server started on port 3000 with /quiz namespace');
console.log('\n📋 Key Changes Made:');
console.log('1. ✅ player-joined now broadcasts with quizNS.to(quizCode).emit()');
console.log('2. ✅ socket.join(quizCode) called before any broadcast');
console.log('3. ✅ submit-answer broadcasts updated leaderboard');
console.log('4. ✅ quiz-finished broadcasts final results');
console.log('5. ✅ player-left broadcasts disconnect event');
console.log('\n🔍 Watch for [BROADCAST] logs to confirm it\'s working!\n');
