# SmartSocket Quiz Client - Receiving Broadcasts

When your SERVER broadcasts with `quizNS.emit()` or `quizNS.to(room).emit()`, your CLIENT needs to LISTEN for these broadcasts.

## 🎯 CLIENT SETUP

### Step 1: Connect to /quiz namespace

```javascript
// Browser or Node.js
import SmartSocketClient from './smartsocket-client/SmartSocketClient.js';

const client = new SmartSocketClient('ws://localhost:3000/quiz');
await client.connect();
console.log('✅ Connected to /quiz namespace');
```

### Step 2: Send your player info

```javascript
// Tell server you joined
client.emit('player-joined', {
  quizCode: 'C8UIFN',
  playerId: 'player_1234',
  playerName: 'John'
}, (ack) => {
  console.log('✅ Server acknowledged:', ack);
});
```

### Step 3: Listen for broadcasts

This is the **critical part** your AI agent needs to do:

```javascript
// Listen for broadcasts FROM THE SERVER
client.on('player-joined', (data) => {
  console.log('📢 Someone joined:', data.playerName);
  console.log('Total players:', data.totalPlayers);
  // Update UI here
});

client.on('new-question', (data) => {
  console.log('📋 New question:', data.text);
  console.log('Options:', data.options);
  // Show question to player
});

client.on('leaderboard-updated', (data) => {
  console.log('🏆 Leaderboard:', data.leaderboard);
  // Update leaderboard display
});

client.on('game-over', (data) => {
  console.log('🎉 Game finished!');
  console.log('Winner:', data.winner.name);
  // Show final results
});

client.on('player-left', (data) => {
  console.log('👋 Player left:', data.remainingPlayers, 'remaining');
  // Update player count
});
```

## 📊 EXPECTED BROADCAST FLOW

```
1. Client A connects:
   client_a.emit('player-joined', { name: 'Alice' })

2. Server receives and broadcasts:
   quizNS.to(quizCode).emit('player-joined', { 
     playerId: 'player_123',
     playerName: 'Alice',
     totalPlayers: 1
   })

3. Client B receives broadcast:
   client_b.on('player-joined', (data) => {
     console.log('Alice joined! Now 1 player');
   })

4. Client A also receives (if it's the room owner):
   client_a.on('player-joined', (data) => {
     console.log('Alice joined! Now 1 player');
   })
```

## 🚀 COMPLETE QUIZ CLIENT EXAMPLE

```javascript
import SmartSocketClient from './smartsocket-client/SmartSocketClient.js';

class QuizClient {
  constructor(quizCode, playerName) {
    this.client = new SmartSocketClient('ws://localhost:3000/quiz');
    this.quizCode = quizCode;
    this.playerName = playerName;
    this.players = [];
    this.leaderboard = [];
    this.currentQuestion = null;
  }

  async connect() {
    await this.client.connect();
    this.setupEventListeners();
    
    // Tell server we joined
    this.client.emit('player-joined', {
      quizCode: this.quizCode,
      playerId: this.generatePlayerId(),
      playerName: this.playerName
    }, (ack) => {
      console.log('✅ Joined quiz:', ack);
    });
  }

  setupEventListeners() {
    // ===== BROADCASTS FROM SERVER =====
    
    // When another player joins
    this.client.on('player-joined', (data) => {
      console.log(`📢 ${data.playerName} joined! (${data.totalPlayers} players)`);
      this.players = data.players || [];
      this.updatePlayerList();
    });

    // When new question is sent
    this.client.on('new-question', (data) => {
      console.log(`📋 Question ${data.questionId}: ${data.text}`);
      this.currentQuestion = data;
      this.displayQuestion(data);
    });

    // When leaderboard updates
    this.client.on('leaderboard-updated', (data) => {
      console.log('🏆 Leaderboard updated:', data.leaderboard);
      this.leaderboard = data.leaderboard;
      this.updateLeaderboard();
    });

    // When game ends
    this.client.on('game-over', (data) => {
      console.log('🎉 Game Over!', data.winner.name, 'wins!');
      this.showGameOver(data);
    });

    // When player leaves
    this.client.on('player-left', (data) => {
      console.log(`👋 Player left (${data.remainingPlayers} remain)`);
      this.updatePlayerList();
    });

    // Status updates
    this.client.on('status', (data) => {
      console.log('📡 Status:', data.message);
    });
  }

  submitAnswer(answer) {
    this.client.emit('submit-answer', {
      quizCode: this.quizCode,
      playerId: this.playerId,
      answer: answer,
      timeUsed: 5000  // milliseconds
    }, (ack) => {
      console.log('✅ Answer submitted:', ack);
    });
  }

  // UI Updates (implement based on your framework)
  displayQuestion(question) {
    console.log(`Question: ${question.text}`);
    console.log(`Options: ${question.options.join(', ')}`);
    console.log(`Time limit: ${question.timeLimit}s`);
  }

  updateLeaderboard() {
    console.table(this.leaderboard);
  }

  updatePlayerList() {
    console.log(`Players: ${this.players.map(p => p.name).join(', ')}`);
  }

  showGameOver(data) {
    console.log(`Winner: ${data.winner.name}`);
    console.log('Final Leaderboard:', data.finalLeaderboard);
  }

  generatePlayerId() {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage:
const quiz = new QuizClient('C8UIFN', 'John');
await quiz.connect();
// Quiz is now listening for all broadcasts
```

## 🧠 FOR YOUR AI AGENT

Your AI agent should:

1. **Connect to /quiz namespace**:
   ```javascript
   const client = new SmartSocketClient('ws://server:3000/quiz');
   await client.connect();
   ```

2. **Join the quiz by sending player-joined event**:
   ```javascript
   client.emit('player-joined', {
     quizCode: 'C8UIFN',
     playerId: 'ai_player_123',
     playerName: 'AI Assistant'
   });
   ```

3. **Register listeners for ALL broadcast events**:
   ```javascript
   // Listen for new questions
   client.on('new-question', async (question) => {
     const answer = await this.analyzeQuestion(question);
     this.submitAnswer(answer);
   });

   // Listen for leaderboard updates
   client.on('leaderboard-updated', (data) => {
     console.log('Current score:', data.currentScore);
     console.log('Position:', data.leaderboard.findIndex(p => p.isCurrentPlayer) + 1);
   });

   // Listen for game end
   client.on('game-over', (data) => {
     console.log('Quiz finished!');
   });
   ```

## ⚠️ DEBUGGING CHECKLIST

If broadcasts aren't working:

- [ ] Server has `quizNS.to(room).emit()` call (NOT just `ack()`)
- [ ] Client calls `socket.join(quizCode)` on server
- [ ] Client is listening with `client.on('event-name', ...)`
- [ ] Event names match exactly (case-sensitive!)
- [ ] Server logs show `[BROADCAST]` messages
- [ ] Check browser console for errors
- [ ] Verify WebSocket connection is stable

## 🔗 RELATED DOCUMENTATION

- [BROADCASTING_FIX_GUIDE.md](./BROADCASTING_FIX_GUIDE.md) - Server-side fix
- [QUIZ_SERVER_EXAMPLE.js](./QUIZ_SERVER_EXAMPLE.js) - Working server example
- [smartsocket-docs/TECHNICAL_DETAILS.md](./smartsocket-docs/TECHNICAL_DETAILS.md) - API reference
- [smartsocket-client/README.md](./smartsocket-client/README.md) - Client API
