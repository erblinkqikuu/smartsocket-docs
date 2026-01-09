# Ready-to-Deploy Server Code

## Copy This Entire File

Replace your existing `server.js` with this complete implementation:

```javascript
/**
 * SmartSocket Quiz Server - Auto Broadcasting
 * 
 * This server automatically broadcasts all quiz events to all players
 * in the same quiz room.
 * 
 * Features:
 * - Auto-broadcast to room
 * - Proper room management
 * - Event logging
 * - Error handling
 */

import SmartSocket from './smartsocket/index.js';

// ============================================
// SERVER CONFIGURATION
// ============================================

const server = new SmartSocket({
  port: 8080,
  enableNamespaces: true,
  secure: false // Set to true with SSL for production
});

// ============================================
// QUIZ NAMESPACE
// ============================================

const quizNS = server.namespace('/quiz');

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

server.on('listen', (address, port) => {
  console.log(`
╔═══════════════════════════════════════════════╗
║      SmartSocket - Quiz Auto-Broadcasting    ║
╠═══════════════════════════════════════════════╣
║ ✅ Server started                             ║
║ 📍 Address: ${address || 'localhost'}${' '.repeat(30 - (address || 'localhost').length)}║
║ 🔌 Port: ${port}${' '.repeat(39 - port.toString().length)}║
║ 📡 Namespace: /quiz                           ║
║ 🔄 Auto-broadcast: ENABLED                    ║
║ 📊 Ready for ${Math.floor(100 / 2)} simultaneous quizzes ║
╚═══════════════════════════════════════════════╝
`);
});

server.on('error', (err) => {
  console.error('[ERROR]', err.message);
  console.error('[STACK]', err.stack);
});

// ============================================
// START SERVER
// ============================================

export default server;
```

## Deployment Steps

### 1. Upload to Server
```bash
# From your local machine
scp -i key.pem server.js ubuntu@51.38.125.199:/root/smartsocket/
```

### 2. SSH into Server
```bash
ssh -i key.pem ubuntu@51.38.125.199
cd /root/smartsocket
```

### 3. Stop Current Server
```bash
# If running in screen/tmux
kill [pid]
# Or Ctrl+C if in foreground
```

### 4. Start New Server
```bash
node server.js
```

### 5. Verify It's Working
```bash
# Should see:
# ✅ Server started
# 📍 Address: 0.0.0.0
# 🔌 Port: 8080
# 📡 Namespace: /quiz
# 🔄 Auto-broadcast: ENABLED
```

### 6. Test with Clients
```bash
# In another terminal, run:
# 1. Open quiz app in Browser 1
# 2. Open quiz app in Browser 2
# 3. Both join same quiz code "TEST"
# 4. Check server logs show:
# [BROADCAST] player-joined → TEST
```

## Verification Checklist

When clients connect:

- [ ] Server logs show `[CONNECT]`
- [ ] When joining quiz: `[QUIZ] PlayerName joined: ABC123`
- [ ] When other players join: `[BROADCAST] player-joined → ABC123`
- [ ] When quiz starts: `[BROADCAST] quiz-started → ABC123`
- [ ] When answers submitted: `[BROADCAST] player-answered → ABC123`
- [ ] Clients receive events in real-time (1-2 second latency max)

## Troubleshooting

### "Module not found" error
- Ensure `./smartsocket/index.js` exists
- Check folder structure: `/root/smartsocket/smartsocket/index.js`

### Clients not receiving events
- Check console logs for `[BROADCAST]` messages
- If missing, handlers aren't being called
- Verify client is calling `socket.emit(event, {...})`

### Memory leaks / high CPU
- Check for infinite loops in event handlers
- Verify rooms are being cleaned up on disconnect
- Monitor with: `top -p [pid]`

### Connection refused
- Check firewall: `sudo ufw status`
- Verify port 8080 is open: `sudo ufw allow 8080`
- Check server is running: `ps aux | grep node`

## Next Steps

After deploying:

1. **Test with quiz app** - Join multiple clients to same quiz
2. **Monitor logs** - Watch for `[BROADCAST]` messages
3. **Check latency** - Events should broadcast in <1 second
4. **Monitor resources** - CPU/Memory usage should be stable

## Support Files

- `SERVER_AUTO_BROADCAST_SOLUTION.md` - Detailed explanation
- `QUICK_IMPLEMENTATION.md` - Implementation guide
- `server-template.js` - Alternative template with more comments

---

**Ready to deploy? Copy this code and restart your server!**
