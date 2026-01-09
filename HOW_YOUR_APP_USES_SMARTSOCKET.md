# SmartSocket Server - How Your App Should Use It

Your `smartsocket` directory contains the **server library**. Your quiz app imports and uses it like this:

## ✅ CORRECT USAGE

```javascript
// Your quiz app's server file
import SmartSocket from './smartsocket/index.js';  // Import your library

const server = new SmartSocket(3000, {
  enableNamespaces: true
});

const quizNS = server.namespace('/quiz');

// ✅ CORRECT: Receive + Broadcast + Acknowledge
quizNS.on('player-joined', (socket, data, ack) => {
  const { quizCode, playerId, playerName } = data;
  
  // 1. Add to room
  socket.join(quizCode);
  
  // 2. Broadcast to all in room
  quizNS.to(quizCode).emit('player-joined', {
    playerId,
    playerName
  });
  
  // 3. Acknowledge sender
  ack({ success: true });
});

server.start();
```

## ❌ WRONG USAGE

```javascript
// ❌ Your current code (missing broadcast)
quizNS.on('player-joined', (socket, data, ack) => {
  socket.data.quizCode = data.quizCode;
  ack({ success: true });  // Only sender gets this!
  
  // ❌ Missing: quizNS.to(quizCode).emit()
});
```

---

## 📚 Available SmartSocket Methods

Your `smartsocket` library provides:

### Server Level
```javascript
const server = new SmartSocket(3000, options);

// Methods:
server.on(event, handler)           // Listen for events
server.emit(event, data)            // Broadcast to all clients globally
server.to(socketId)                 // Send to specific client
server.namespace(path)              // Create namespace
server.broadcast(event, data)       // Broadcast to all (alias for emit)
server.start()                      // Start listening
server.stop()                        // Stop server
server.getStats()                   // Get server statistics
```

### Namespace Level
```javascript
const ns = server.namespace('/quiz');

// Methods:
ns.on(event, handler)               // Listen in this namespace
ns.emit(event, data)                // Broadcast to all in namespace
ns.to(room).emit(event, data)      // Broadcast to specific room
ns.broadcast(sender, event, data)   // Broadcast except sender
ns.addSocket(socket)                // Add socket to namespace
ns.removeSocket(socket)             // Remove socket from namespace
```

### Socket Level
```javascript
// Inside event handler: (socket, data, ack)

socket.on(event, handler)           // Listen on this socket
socket.emit(event, data)            // Send to this socket
socket.join(room)                   // Add to room
socket.leave(room)                  // Remove from room
socket.broadcast(event, data)       // Broadcast except this socket
socket.disconnect()                 // Close connection
socket.data                         // Store custom data on socket
```

---

## 🎯 Your SmartSocket Library Features

Check `smartsocket/index.js` for these features:

| Feature | Usage |
|---------|-------|
| **Namespaces** | `server.namespace('/quiz')` |
| **Rooms** | `socket.join(roomName)` |
| **Broadcasting** | `ns.to(room).emit(event, data)` |
| **Acknowledgments** | `ack({ success: true })` |
| **Middleware** | `ns.use((socket, event, data, next) => {})` |
| **Encryption** | Enable with `encryptionKey` option |
| **Compression** | Enable with `compressionLevel` option |
| **Rate Limiting** | Enable with `rateLimitMaxRequests` option |
| **Connection Pool** | Enable with `enableConnectionPooling` |

---

## 🔧 How To Fix Your Quiz App

Your quiz app needs to follow this pattern for EVERY event that should notify other players:

### Pattern
```javascript
quizNS.on('EVENT_NAME', (socket, data, ack) => {
  // Step 1: Extract data
  const { quizCode, ... } = data;
  
  // Step 2: Join room (if not already done)
  socket.join(quizCode);
  
  // Step 3: BROADCAST to room
  quizNS.to(quizCode).emit('BROADCAST_EVENT_NAME', {
    // Your broadcast data
  });
  
  // Step 4: Acknowledge sender
  ack({ success: true });
});
```

### Apply to These Events
1. **player-joined** → Broadcast new player info
2. **submit-answer** → Broadcast updated leaderboard
3. **next-question** → Broadcast new question
4. **quiz-finished** → Broadcast game over
5. **player-left** → Broadcast disconnect

---

## 📋 Checklist for Your Quiz App

For each event handler in your quiz app:

- [ ] Call `socket.join(roomName)` to add to room
- [ ] Call `quizNS.to(roomName).emit(...)` to broadcast
- [ ] Keep `ack(...)` at end to acknowledge sender
- [ ] Don't forget `.to(roomName)` - without it, broadcasts to ALL players globally
- [ ] Test with 2 clients and verify `[BROADCAST]` logs appear

---

## 🚀 Summary

Your `smartsocket` library HAS all the broadcasting features. Your quiz app just needs to:

1. **Use `socket.join(room)`** before broadcasting to that room
2. **Use `quizNS.to(room).emit()`** to broadcast to the room
3. **Use `server.to(socketId).emit()`** for private messages

That's it! The broadcasting infrastructure is already there. You just need to call it.

See [APPLY_THIS_FIX_NOW.md](./APPLY_THIS_FIX_NOW.md) for the exact 3-line fix.
