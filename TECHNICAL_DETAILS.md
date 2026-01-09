# SmartSocket Technical Details

Deep technical documentation for implementers and contributors.

**Version**: 1.0.0  
**Last Updated**: January 9, 2026

---

## Table of Contents

1. [Type Definitions](#type-definitions)
2. [Binary Protocol](#binary-protocol)
3. [Reconnection Algorithm](#reconnection-algorithm)
4. [WebSocket Details](#websocket-details)
5. [Error Codes](#error-codes)
6. [Heartbeat Mechanism](#heartbeat-mechanism)
7. [Message Queue](#message-queue)
8. [Memory Management](#memory-management)
9. [Timeout Behavior](#timeout-behavior)
10. [Debug Logging](#debug-logging)
11. [Connection Pool Internals](#connection-pool-internals)
12. [Rate Limiting Algorithm](#rate-limiting-algorithm)
13. [Compression Details](#compression-details)
14. [Encryption Key Management](#encryption-key-management)
15. [Browser Compatibility](#browser-compatibility)

---

## Type Definitions

### SmartSocket Server

```typescript
interface SmartSocketOptions {
  port: number;                           // Server port (default: 3000)
  host: string;                           // Bind address (default: 'localhost')
  enableEncryption: boolean;              // Enable AES-256 encryption (default: true)
  encryptionKey?: string;                 // 32-byte base64 encryption key
  encryptionAlgorithm: string;            // Algorithm: 'aes-256-cbc' (default)
  enableRateLimiting: boolean;            // Enable rate limiting (default: true)
  rateLimitWindow: number;                // Window in ms (default: 60000)
  rateLimitMaxRequests: number;           // Max requests per window (default: 100)
  enableConnectionPooling: boolean;       // Enable pooling (default: true)
  enableMessageCache: boolean;            // Cache messages (default: false)
  maxConnections: number;                 // Max clients (default: 10000)
  connectionTimeout: number;              // Timeout in ms (default: 30000)
  compressionThreshold: number;           // Compress if > bytes (default: 1024)
  compressionLevel: number;               // 1-9, 6=default (default: 6)
}

interface Socket {
  id: string;                             // Unique socket ID (UUID v4)
  connected: boolean;                     // Connection status
  data: Record<string, any>;              // User-defined data storage
  on(event: string, callback: (...args: any[]) => void): void;
  once(event: string, callback: (...args: any[]) => void): void;
  off(event: string): void;
  emit(event: string, data?: any, ack?: Function): void;
  disconnect(): void;
  requireAuth: boolean;
}

interface SmartSocketServer {
  start(): void;
  stop(): void;
  namespace(path: string): Namespace;
  on(event: string, callback: (socket: Socket, ...args: any[]) => void): void;
  emit(event: string, data: any): void;
  to(socketId: string): { emit: (event: string, data: any) => void };
  getStats(): ServerStats;
  getConnectionStats(): ConnectionStats;
  getNamespaceStats(): Record<string, NamespaceStats>;
  use(middleware: MiddlewareFunction): void;
  setEventRateLimit(event: string, config: RateLimitConfig): void;
}

interface ServerStats {
  connections: number;
  memoryUsage: string;                    // e.g., "45MB"
  uptime: number;                         // milliseconds
  messagesPerSecond: number;
  averageLatency: number;                 // milliseconds
}

interface NamespaceStats {
  connections: number;
  memoryUsage: string;
  events: Record<string, number>;         // Event counts
}

interface RateLimitConfig {
  window: number;                         // Time window in ms
  maxRequests: number;                    // Max requests in window
}
```

### SmartSocket Client

```typescript
interface SmartSocketClientOptions {
  namespace: string;                      // Namespace path (default: '/')
  enableNamespaces: boolean;              // Support namespaces (default: true)
  enableAcknowledgments: boolean;         // Support acks (default: true)
  enableErrorHandling: boolean;           // Error handling (default: true)
  enableEncryption: boolean;              // Enable encryption (default: false)
  encryptionKey?: string;                 // 32-byte base64 encryption key
  apiKey?: string;                        // Optional API key for auth
  reconnectDelay: number;                 // Initial delay ms (default: 1000)
  maxReconnectAttempts: number;           // Max attempts (default: 10)
  ackTimeout: number;                     // Timeout ms (default: 30000)
}

interface SmartSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  connected: boolean;
  data: Record<string, any>;
  on(event: string, callback: (...args: any[]) => void): void;
  once(event: string, callback: (...args: any[]) => void): void;
  off(event: string): void;
  emit(event: string, data?: any, ack?: (response: any) => void): void;
}

interface AcknowledgmentCallback {
  (response: {
    success?: boolean;
    error?: string;
    code?: string;
    [key: string]: any;
  }): void;
}
```

---

## Binary Protocol

### Message Format

```
[FRAME HEADER] [MESSAGE TYPE] [NAMESPACE] [EVENT] [DATA] [ACK_ID]

Frame Structure (Binary):
├─ Version Byte (1 byte): 0x01
├─ Type Byte (1 byte): Message type (0x01-0x07)
├─ Flags Byte (1 byte): Compression, encryption, acknowledgment
├─ Namespace Length (2 bytes): Big-endian uint16
├─ Namespace (variable): UTF-8 string
├─ Event Length (2 bytes): Big-endian uint16
├─ Event (variable): UTF-8 string
├─ ACK ID (4 bytes, optional): Big-endian uint32
├─ Data Length (4 bytes): Big-endian uint32
└─ Data (variable): Binary or compressed JSON
```

### Message Types

```
0x01 = CONNECT
0x02 = DISCONNECT
0x03 = EVENT
0x04 = ACKNOWLEDGMENT
0x05 = ERROR
0x06 = HEARTBEAT
0x07 = HEARTBEAT_ACK
```

### Flags Byte Structure

```
Bit 7: Compression flag (1 = compressed)
Bit 6: Encryption flag (1 = encrypted)
Bit 5: Acknowledgment requested (1 = ack required)
Bit 4: Binary data (1 = binary, 0 = JSON)
Bits 0-3: Reserved
```

### Example Message

```
Raw bytes for event: { type: 'chat', text: 'Hello' }

[01] [03] [00] [00 01] [/chat] [00 04] [chat] [00 00 00 2F] [{"type":"chat","text":"Hello"}]
│    │    │    │      │       │      │      │              │
│    │    │    │      │       │      │      │              └─ Data (47 bytes)
│    │    │    │      │       │      │      └─ Event: "chat"
│    │    │    │      │       │      └─ Event length: 4
│    │    │    │      │       └─ Namespace: "/chat"
│    │    │    │      └─ Namespace length: 1
│    │    │    └─ Flags: 0x00 (no compression, no encryption)
│    │    └─ Type: EVENT
│    └─ Version: 1
└─ Frame start
```

---

## Reconnection Algorithm

### Exponential Backoff Formula

```
delay(attempt) = reconnectDelay * (1.5 ^ attempt)

Where:
  - reconnectDelay = initial delay (default: 1000ms)
  - attempt = reconnection attempt number (0-indexed)
  - Maximum delay: capped at 60000ms (1 minute)
  - Maximum attempts: maxReconnectAttempts (default: 10)
```

### Example Timeline (Default Settings)

```
Attempt 0: 1000ms (1 second)
Attempt 1: 1500ms (1.5 seconds)
Attempt 2: 2250ms (2.25 seconds)
Attempt 3: 3375ms (3.375 seconds)
Attempt 4: 5062ms (5 seconds)
Attempt 5: 7593ms (7.6 seconds)
Attempt 6: 11390ms (11.4 seconds)
Attempt 7: 17085ms (17 seconds)
Attempt 8: 25627ms (25.6 seconds)
Attempt 9: 38440ms (38.4 seconds)
Attempt 10: 57661ms → capped at 60000ms
```

### Reconnection Logic

```javascript
reconnect(attempt = 0) {
  if (attempt >= this.maxReconnectAttempts) {
    this.emit('max-reconnect-attempts-reached');
    return;
  }

  const delay = Math.min(
    this.reconnectDelay * Math.pow(1.5, attempt),
    60000  // Cap at 60 seconds
  );

  console.log(`Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

  setTimeout(() => {
    this.connect()
      .then(() => {
        this.reconnectAttempt = 0;  // Reset on success
        this.emit('reconnected');
      })
      .catch(() => {
        this.reconnect(attempt + 1);
      });
  }, delay);
}
```

---

## WebSocket Details

### Protocol Version

```
WebSocket Protocol: RFC 6455 (IETF Standard)
Handshake Version: 13
Subprotocol: "smartsocket-v1"
```

### Secure Connection (WSS)

```javascript
// Client example for WSS
const client = new SmartSocketClient('wss://your-domain.com:3000', {
  // wss = WebSocket Secure (TLS/SSL encrypted)
});

// Server example with WSS
const fs = require('fs');
const https = require('https');
const SmartSocket = require('smartsocket');

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};

const httpsServer = https.createServer(options);
const server = new SmartSocket({
  port: 3000,
  server: httpsServer  // Attach to HTTPS server
});
```

### Connection Lifecycle

```
CLIENT                          SERVER
  │                               │
  ├── TCP Connection Setup ──────>│
  │                               │
  ├── WebSocket Handshake ──────>│
  │                           │ Verify request
  │                           │ Send handshake response
  │<─ Handshake Response ──────┤
  │                               │
  ├── SmartSocket CONNECT ──────>│
  │                           │ Validate encryption key
  │                           │ Create socket object
  │<─ Connection ACK ──────────┤
  │                               │
  ├─ (bidirectional communication)
  │<──────────────────────────── [events can flow both ways]
  │──────────────────────────>│
  │                               │
  ├── DISCONNECT ────────────────>│
  │                               │
  ├── Close Frame ────────────────>│
  │                           │ Clean up socket
  │<─ Close Frame ────────────┤
  │                               │
  └─ TCP Connection Close ──────>│
```

---

## Error Codes

### Connection Errors

```
ERR_CONN_001: Connection refused
  Cause: Server not listening
  Action: Verify server is running, check host/port

ERR_CONN_002: Connection timeout
  Cause: No response from server
  Action: Check network, verify server is responding

ERR_CONN_003: Handshake failed
  Cause: Invalid WebSocket handshake
  Action: Verify server version compatibility

ERR_CONN_004: Authentication failed
  Cause: Invalid encryption key or API key
  Action: Verify encryption keys match on both sides

ERR_CONN_005: Max connections exceeded
  Cause: Server at maxConnections limit
  Action: Increase server maxConnections or close unused connections

ERR_CONN_006: Connection lost
  Cause: Network interruption
  Action: Client will auto-reconnect with exponential backoff
```

### Message Errors

```
ERR_MSG_001: Invalid message format
  Cause: Malformed binary protocol
  Action: Verify message structure, check compatibility

ERR_MSG_002: Decompression failed
  Cause: Invalid compressed data
  Action: Check compression settings

ERR_MSG_003: Decryption failed
  Cause: Wrong encryption key or corrupted data
  Action: Verify encryption keys match

ERR_MSG_004: Message too large
  Cause: Data exceeds maximum size (~16MB)
  Action: Split message or enable compression

ERR_MSG_005: Invalid namespace
  Cause: Namespace doesn't exist
  Action: Verify namespace path format
```

### Rate Limiting Errors

```
ERR_RATE_001: Rate limit exceeded
  Cause: Too many requests in time window
  Action: Wait for window to reset or increase limit

ERR_RATE_002: Event rate limit exceeded
  Cause: Specific event rate limit triggered
  Action: Wait before sending same event again
```

### Acknowledgment Errors

```
ERR_ACK_001: Acknowledgment timeout
  Cause: Server didn't respond within ackTimeout
  Action: Increase ackTimeout or check server processing

ERR_ACK_002: Invalid acknowledgment format
  Cause: Malformed ack response
  Action: Verify ack callback response format

ERR_ACK_003: Acknowledgment for unknown message
  Cause: Ack ID doesn't match sent message
  Action: Internal error - report to maintainers
```

---

## Heartbeat Mechanism

### Heartbeat Protocol

```
Client sends HEARTBEAT every 30 seconds

Server responds with HEARTBEAT_ACK within 5 seconds

If no HEARTBEAT_ACK received:
  ├─ Retry 3 times with 2 second intervals
  ├─ If still no response: Connection dead
  └─ Client initiates reconnection
```

### Implementation

```javascript
// Client side
startHeartbeat() {
  this.heartbeatInterval = setInterval(() => {
    this.send({
      type: MESSAGE_TYPE.HEARTBEAT,
      timestamp: Date.now()
    });

    // Set timeout for heartbeat response
    this.heartbeatTimeout = setTimeout(() => {
      this.heartbeatMissed++;
      
      if (this.heartbeatMissed >= 3) {
        console.warn('Heartbeat failed, reconnecting...');
        this.disconnect();
        this.connect();
      }
    }, 5000);  // 5 second timeout
  }, 30000);   // Every 30 seconds
}

// Server side
handleHeartbeat(socket) {
  socket.send({
    type: MESSAGE_TYPE.HEARTBEAT_ACK,
    timestamp: Date.now()
  });
}
```

---

## Message Queue

### Queue Behavior During Reconnection

```javascript
// When client disconnects, queued messages stored
class MessageQueue {
  constructor(maxSize = 1000) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  enqueue(message) {
    if (this.queue.length >= this.maxSize) {
      // Remove oldest message
      this.queue.shift();
    }
    this.queue.push({
      message,
      timestamp: Date.now()
    });
  }

  flush(socket) {
    while (this.queue.length > 0) {
      const { message } = this.queue.shift();
      socket.send(message);
    }
  }
}

// Usage during reconnection
client.on('connected', () => {
  this.messageQueue.flush(this.socket);
});
```

### Queue Limits

```
Maximum queue size: 1000 messages
Maximum message age: 5 minutes
If queue full: Oldest messages discarded
If reconnection fails: Queue cleared after 10 minutes
```

---

## Memory Management

### Memory Per Connection

```
Base socket object: ~1.5 KB
Event listeners (avg 5): ~500 bytes
Data object: ~2-5 KB
Buffers and state: ~1 KB

Total per connection: ~5-7 KB (without user data)
```

### Memory Optimization

```javascript
// Proper cleanup
client.off('event-name');  // Remove listener
client.disconnect();       // Disconnect and cleanup
client = null;             // Garbage collection

// Avoid memory leaks
socket.on('message', (data) => {
  // DON'T create closures with large objects
  largeData = data;  // BAD - prevents GC
  
  // DO process and discard
  process(data);     // GOOD - allows GC
});
```

### Server Memory Monitoring

```javascript
// Monitor memory usage
setInterval(() => {
  const stats = server.getStats();
  const memMB = parseFloat(stats.memoryUsage);
  
  if (memMB > 500) {  // Alert if > 500MB
    console.warn('High memory usage:', memMB + 'MB');
    console.log('Connections:', stats.connections);
  }
}, 60000);  // Every 60 seconds
```

---

## Timeout Behavior

### Acknowledgment Timeout

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  ackTimeout: 30000  // 30 seconds
});

client.emit('save-data', { data: 'value' }, (ack) => {
  // This callback is called when server responds
  // OR after 30 seconds (whichever comes first)
});

// Timeout flow:
// 1. Message sent with unique ACK_ID
// 2. Timer started for ackTimeout duration
// 3. Server responds with same ACK_ID → Cancel timer, call callback
// 4. Timer expires → Call callback with timeout error
//    callback({ error: 'Acknowledgment timeout', code: 'ERR_ACK_001' })
```

### Connection Timeout

```javascript
const server = new SmartSocket({
  connectionTimeout: 30000  // 30 seconds
});

// Flow:
// 1. Connection established
// 2. If no activity for 30 seconds
// 3. Server sends HEARTBEAT
// 4. If no HEARTBEAT_ACK within 5 seconds
// 5. Connection dropped and socket cleaned up
```

---

## Debug Logging

### Enable Debug Mode

```javascript
// Set environment variable
process.env.DEBUG = 'smartsocket:*';

// Or in code
const logger = require('smartsocket-client/logger.js');
logger.setLevel('debug');

// Logging levels
logger.setLevel('error');    // Only errors
logger.setLevel('warn');     // Warnings and errors
logger.setLevel('info');     // Normal operations
logger.setLevel('debug');    // Detailed debugging
logger.setLevel('trace');    // Very detailed
```

### Log Output

```
[smartsocket] [debug] Connecting to ws://localhost:3000
[smartsocket] [debug] WebSocket opened
[smartsocket] [debug] Sending CONNECT message
[smartsocket] [debug] Received CONNECT_ACK
[smartsocket] [debug] Emitting event: message { text: 'Hello' }
[smartsocket] [debug] Sent 125 bytes (compressed to 89 bytes)
[smartsocket] [debug] Heartbeat sent (id: 1234)
```

---

## Connection Pool Internals

### Pool Architecture

```
Pool Manager
├─ Available Pool [500 connections]
├─ In-Use Pool [450 connections]
└─ Reserve Pool [100 connections]

Total: 1000 connections (maxPoolSize)
Initial: 500 connections (poolSize)
Growth: 50% increase when needed (poolGrowthRate)
```

### Pool Operations

```javascript
// Acquire connection from pool
acquireConnection() {
  if (this.available.length > 0) {
    return this.available.pop();  // O(1) operation
  }
  
  if (this.inUse.length < this.maxPoolSize) {
    return this.createNewConnection();
  }
  
  // Pool exhausted
  throw new Error('ERR_CONN_005: Max connections exceeded');
}

// Release connection back to pool
releaseConnection(conn) {
  if (this.available.length < this.poolSize) {
    this.available.push(conn);  // Return to available
  } else {
    conn.close();               // Destroy excess
  }
}

// Growth when needed
growPool() {
  const growth = Math.floor(this.poolSize * this.poolGrowthRate);
  for (let i = 0; i < growth; i++) {
    this.available.push(this.createNewConnection());
  }
}
```

---

## Rate Limiting Algorithm

### Sliding Window Counter Algorithm

```
Time:    0ms    1000ms   2000ms   3000ms   4000ms
         │      │        │        │        │
Request: [1]    [2]      [3]      [4]      [5]
Counter: 1      2        3        2        1

Window = 3000ms (past 3 seconds)

At 4000ms: Only requests from 1000ms onward count (requests 2, 3, 4)
           Requests 1 (0ms) is outside window and not counted
```

### Implementation

```javascript
class RateLimiter {
  constructor(window, maxRequests) {
    this.window = window;
    this.maxRequests = maxRequests;
    this.requests = [];  // Timestamps
  }

  isAllowed() {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requests = this.requests.filter(
      ts => now - ts < this.window
    );
    
    // Check limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Add new request
    this.requests.push(now);
    return true;
  }

  reset() {
    this.requests = [];
  }
}
```

### Per-Client Limiting

```javascript
server.use((socket, event, data, next) => {
  const limiter = socket.rateLimiter || 
    (socket.rateLimiter = new RateLimiter(60000, 100));
  
  if (!limiter.isAllowed()) {
    return next(new Error('Rate limit exceeded'));
  }
  
  next();
});
```

---

## Compression Details

### DEFLATE Settings

```
Algorithm: DEFLATE (RFC 1951)
Level: 1-9 (6 is default)
  1 = Fastest, worst compression
  6 = Balance (default)
  9 = Slowest, best compression

Threshold: Only compress if message > threshold bytes
Default: 1024 bytes
```

### Compression Performance

```
Level 1: 10% reduction, <1ms overhead
Level 6: 60% reduction, 2-3ms overhead
Level 9: 70% reduction, 5-10ms overhead
```

### Compression Example

```javascript
// Server config
const server = new SmartSocket({
  compressionThreshold: 512,  // Compress > 512 bytes
  compressionLevel: 6
});

// For message of 5000 bytes:
// Original size: 5000 bytes
// Compressed size: 1500 bytes (30% of original)
// Overhead: 2ms compression + 1ms decompression
// Bandwidth saved: 3500 bytes (70%)
// Net benefit: 3498 bytes saved vs 3ms latency
```

---

## Encryption Key Management

### Key Generation

```bash
# Generate 32-byte (256-bit) key in base64
openssl rand -base64 32

# Output example:
# k3mZ7x9pQ2vL8nR5tY1hJ4bF6wS0dA2eK9mX7cP3vN=
```

### Key Storage

```javascript
// DO: Store in environment variable
const encryptionKey = process.env.ENCRYPTION_KEY;

// DO: Store in secure vault
// Using AWS Secrets Manager, HashiCorp Vault, etc.

// DON'T: Hardcode in source
// const key = 'k3mZ7x9pQ2vL8nR5tY1hJ4bF6wS0dA2eK9mX7cP3vN=';

// DON'T: Commit to git
// .gitignore must include .env files
```

### Key Exchange

```
Client and Server must use SAME encryption key

Setup:
1. Generate 32-byte key: openssl rand -base64 32
2. Store in environment variable on server: ENCRYPTION_KEY
3. Store same value on client (hardcode or env var)
4. Both must use identical base64 string

Verification:
- If keys don't match: ERR_CONN_004 (Authentication failed)
- Check server and client keys are byte-for-byte identical
- Base64 encoding must not change (whitespace matters)
```

### Key Rotation (Security Best Practice)

```javascript
// Schedule key rotation every 90 days
// 1. Generate new key
// 2. Update environment variables
// 3. Restart server and clients
// 4. Old connections will reconnect with new key

// During rotation:
setInterval(() => {
  const newKey = process.env.ENCRYPTION_KEY_NEW;
  if (newKey && newKey !== currentKey) {
    server.rotateEncryptionKey(newKey);
    currentKey = newKey;
  }
}, 86400000);  // Every 24 hours
```

---

## Browser Compatibility

### Supported Browsers

```
Desktop:
✅ Chrome 43+ (2015)
✅ Firefox 48+ (2016)
✅ Safari 10.1+ (2016)
✅ Edge 14+ (2016)

Mobile:
✅ iOS Safari 10.1+
✅ Android Chrome 43+
✅ Android Firefox 48+
✅ Samsung Internet 4+

Node.js:
✅ Node.js 12+
✅ Node.js 14+
✅ Node.js 16+
✅ Node.js 18+
```

### Polyfills Needed

```javascript
// For older browsers, provide WebSocket polyfill
<script src="websocket-polyfill.js"></script>

// Check browser support
if (!window.WebSocket) {
  console.error('WebSocket not supported');
}
```

### Feature Detection

```javascript
// Check WebSocket support
const supportsWebSocket = typeof WebSocket !== 'undefined' ||
                          typeof MozWebSocket !== 'undefined';

// Check binary support
const supportsBinary = WebSocket.prototype.binaryType !== undefined;

// Check compression support
const supportsCompression = 
  'permessage-deflate' in WebSocket.prototype;
```

### CORS and Security

```javascript
// Server-side CORS configuration
const server = new SmartSocket({
  port: 3000,
  allowedOrigins: [
    'http://localhost:3000',
    'https://myapp.com'
  ]
});

// Client-side headers (if needed)
const client = new SmartSocketClient('ws://server:3000', {
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

---

## Implementation Checklist

When implementing SmartSocket in a new project:

- [ ] Review Type Definitions for your language
- [ ] Understand Binary Protocol format
- [ ] Configure Reconnection timeouts appropriately
- [ ] Use WSS (WebSocket Secure) in production
- [ ] Handle all Error Codes gracefully
- [ ] Implement Heartbeat monitoring
- [ ] Handle Message Queue during disconnections
- [ ] Monitor Memory Usage regularly
- [ ] Configure appropriate Timeouts
- [ ] Enable Debug Logging in development
- [ ] Optimize Connection Pool settings
- [ ] Implement Rate Limiting per use case
- [ ] Choose Compression Level based on latency needs
- [ ] Secure Encryption Keys properly
- [ ] Test Browser Compatibility

---

**Ready for production implementation!** 🚀
