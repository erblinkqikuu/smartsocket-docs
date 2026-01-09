# Auto-Broadcast Server Setup Guide

## Problem
The external server has the SmartSocket library installed but **no event handlers** that automatically broadcast client events to other clients in the same room.

**Client sends**: `socket.emit('player-joined', { ... })`  
**Server receives**: Message logged as `[MESSAGE]`  
**Server broadcasts**: ❌ NOT happening - no handler calls `.emit()`

## Solution
The server needs event handlers that automatically relay/broadcast messages. Here's what to add to `server.js`:

### Architecture
```
Client A emits 'player-joined'
    ↓
Server receives in handler
    ↓
Server broadcasts: quizNS.to(quizCode).emit('player-joined', data)
    ↓
All clients in quiz room receive update
```

### Key Events to Handle
These are the events clients emit (from `lib/smartsocket.ts`):

1. **`join-quiz`** - Player joins a quiz room
   - Data: `{ quizCode, playerId, playerName }`
   - Action: Add socket to room, broadcast to room

2. **`player-joined`** - Notify others that player joined
   - Data: `{ quizCode, playerId, playerName }`
   - Action: Broadcast to all in room

3. **`quiz-started`** - Quiz host starts the quiz
   - Data: `{ quizCode, questions, projectMode }`
   - Action: Broadcast to all in room

4. **`timer-start`** - Question timer starts
   - Data: `{ quizCode, duration }`
   - Action: Broadcast to all in room

5. **`next-question`** - Move to next question
   - Data: `{ quizCode, questionIndex }`
   - Action: Broadcast to all in room

6. **`player-answered`** - Player submitted answer
   - Data: `{ quizCode, playerId, answerIndex }`
   - Action: Broadcast to all in room

7. **`skip-question`** - Skip current question
   - Data: `{ quizCode, questionIndex }`
   - Action: Broadcast to all in room

8. **`show-answer`** - Reveal correct answer
   - Data: `{ quizCode, questionIndex }`
   - Action: Broadcast to all in room

9. **`end-quiz`** - End the quiz
   - Data: `{ quizCode }`
   - Action: Broadcast to all in room

10. **`show-results`** - Display results
    - Data: `{ quizCode, results }`
    - Action: Broadcast to all in room

11. **`get-players`** - Request player list
    - Data: `{ quizCode }`
    - Action: Send list of players in room

## Implementation Example

```javascript
// server.js - Add these handlers

const quizNS = server.namespace('/quiz');

// Handle join-quiz to add socket to room
quizNS.on('join-quiz', (socket, data) => {
  const { quizCode, playerId, playerName } = data;
  
  // Add socket to room (for broadcasting)
  socket.join(quizCode);
  
  console.log(`[BROADCAST] ${playerName} joined quiz ${quizCode}`);
  
  // Broadcast to all in room
  quizNS.to(quizCode).emit('player-joined', {
    quizCode,
    playerId,
    playerName,
    timestamp: Date.now()
  });
});

// Handle all quiz events - broadcast to room
const quizEvents = [
  'player-joined',
  'quiz-started',
  'timer-start',
  'next-question',
  'player-answered',
  'skip-question',
  'show-answer',
  'end-quiz',
  'show-results'
];

quizEvents.forEach(event => {
  quizNS.on(event, (socket, data) => {
    const quizCode = data.quizCode;
    
    console.log(`[BROADCAST] Event: ${event} with data:`, data);
    
    // Broadcast to all clients in the quiz room
    quizNS.to(quizCode).emit(event, data);
  });
});

// Handle get-players request
quizNS.on('get-players', (socket, data) => {
  const { quizCode } = data;
  
  // Get all sockets in room
  const room = quizNS.rooms.get(quizCode);
  const playerCount = room ? room.size : 0;
  
  console.log(`[BROADCAST] Sending player count (${playerCount}) for quiz ${quizCode}`);
  
  // Send back to requesting client only
  socket.emit('players-list', {
    quizCode,
    count: playerCount
  });
});
```

## Testing
After adding these handlers:

1. Start the server
2. Have multiple clients connect to `/quiz` namespace
3. One client sends: `socket.emit('player-joined', {...})`
4. **Expected**: Server logs `[BROADCAST] Event: player-joined`
5. **Expected**: All other clients receive the event

## Key Points
- ✅ SmartSocket library has `to(room).emit()` - WORKING
- ✅ `joinRoom()` method exists to add sockets to rooms
- ❌ **Server handlers are missing** - need to add them
- Without handlers, server receives messages but doesn't broadcast
- Each event handler calls `quizNS.to(quizCode).emit(event, data)`

## Broadcasting Flow
```javascript
// Handler receives event from client
quizNS.on('player-joined', (socket, data) => {
  
  // Extract quiz room identifier
  const { quizCode } = data;
  
  // Use SmartSocket to broadcast to room
  quizNS.to(quizCode).emit('player-joined', data);
  //    ↑
  // This is the fix - call the fixed to(room).emit() method
});
```

## Verification Checklist
- [ ] Event handlers registered on namespace
- [ ] Handlers call `quizNS.to(quizCode).emit(event, data)`
- [ ] Sockets join rooms via `quizNS.joinRoom(socket, quizCode)`
- [ ] Server logs show `[BROADCAST]` messages
- [ ] Clients receive broadcast events
- [ ] `namespace.js` has the fix (check for error handling in `to()` method)
