# SmartSocket Technical Reference

Complete API reference and implementation guide for developers.

**Version**: 1.0.0  
**Last Updated**: January 9, 2026

---

## Table of Contents

1. [Type Definitions](#type-definitions)
2. [Configuration Options](#configuration-options)
3. [Error Codes](#error-codes)
4. [Reconnection Settings](#reconnection-settings)
5. [Timeout Settings](#timeout-settings)
6. [Compression Configuration](#compression-configuration)
7. [Encryption Setup](#encryption-setup)
8. [Rate Limiting Configuration](#rate-limiting-configuration)
9. [Connection Pool Configuration](#connection-pool-configuration)
10. [Debug Logging](#debug-logging)
11. [Browser Compatibility](#browser-compatibility)
12. [Performance Tuning](#performance-tuning)
13. [Security Best Practices](#security-best-practices)
14. [Memory Usage](#memory-usage)
15. [Implementation Checklist](#implementation-checklist)

---

## Type Definitions

### Server API

```typescript
interface SmartSocket {
  // Connection Management
  start(): void;
  stop(): void;
  
  // Namespaces
  namespace(path: string): Namespace;
  
  // Events
  on(event: string, callback: (socket: Socket, ...args: any[]) => void): void;
  emit(event: string, data: any): void;
  to(socketId: string): { emit: (event: string, data: any) => void };
  
  // Statistics
  getStats(): ServerStats;
  getConnectionStats(): ConnectionStats;
  getNamespaceStats(): Record<string, NamespaceStats>;
  
  // Middleware
  use(middleware: (socket: Socket, event: string, data: any, next: Function) => void): void;
  
  // Rate Limiting
  setEventRateLimit(event: string, config: RateLimitConfig): void;
}

interface Socket {
  id: string;
  connected: boolean;
  data: Record<string, any>;
  
  on(event: string, callback: (data?: any, ack?: Function) => void): void;
  once(event: string, callback: (data?: any, ack?: Function) => void): void;
  off(event: string): void;
  emit(event: string, data?: any): void;
  disconnect(): void;
}

interface ServerStats {
  connections: number;
  memoryUsage: string;
  uptime: number;
  messagesPerSecond: number;
  averageLatency: number;
}

interface RateLimitConfig {
  window: number;
  maxRequests: number;
}

interface Namespace {
  on(event: string, callback: (socket: Socket, data?: any, ack?: Function) => void): void;
  emit(event: string, data: any): void;
  to(socketId: string): { emit: (event: string, data: any) => void };
  use(middleware: Function): void;
}
```

### Client API

```typescript
interface SmartSocketClient {
  // Connection
  connect(): Promise<void>;
  disconnect(): void;
  connected: boolean;
  
  // Data Storage
  data: Record<string, any>;
  
  // Events
  on(event: string, callback: (...args: any[]) => void): void;
  once(event: string, callback: (...args: any[]) => void): void;
  off(event: string): void;
  emit(event: string, data?: any, ack?: (response: any) => void): void;
}
```

---

## Configuration Options

### Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | 3000 | Port to listen on |
| `host` | string | 'localhost' | Host to bind to (use '0.0.0.0' for production) |
| `enableEncryption` | boolean | true | Enable AES-256 encryption |
| `encryptionKey` | string | - | 32-byte base64 encryption key (required if encryption enabled) |
| `encryptionAlgorithm` | string | 'aes-256-cbc' | Encryption algorithm |
| `enableRateLimiting` | boolean | true | Enable rate limiting protection |
| `rateLimitWindow` | number | 60000 | Rate limit time window (ms) |
| `rateLimitMaxRequests` | number | 100 | Max requests per window per client |
| `enableConnectionPooling` | boolean | true | Enable connection pool optimization |
| `enableMessageCache` | boolean | false | Cache messages for offline clients |
| `maxConnections` | number | 10000 | Maximum simultaneous connections |
| `connectionTimeout` | number | 30000 | Connection idle timeout (ms) |
| `compressionThreshold` | number | 1024 | Compress messages larger than this (bytes) |
| `compressionLevel` | number | 6 | Compression level (1-9) |

### Client Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namespace` | string | '/' | Namespace to connect to |
| `enableNamespaces` | boolean | true | Support multiple namespaces |
| `enableAcknowledgments` | boolean | true | Enable acknowledgment callbacks |
| `enableErrorHandling` | boolean | true | Enable error event handling |
| `enableEncryption` | boolean | false | Enable encryption (match server setting) |
| `encryptionKey` | string | - | Must match server encryption key |
| `apiKey` | string | - | Optional API key for authentication |
| `reconnectDelay` | number | 1000 | Initial reconnection delay (ms) |
| `maxReconnectAttempts` | number | 10 | Maximum reconnection attempts |
| `ackTimeout` | number | 30000 | Acknowledgment timeout (ms) |

---

## Configuration Examples

### Basic Server

```javascript
const SmartSocket = require('smartsocket');

const server = new SmartSocket({
  port: 3000,
  host: '0.0.0.0'
});

server.start();
console.log('Server running on port 3000');
```

### Production Server

```javascript
const server = new SmartSocket({
  port: process.env.PORT || 3000,
  host: '0.0.0.0',
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY,
  enableRateLimiting: true,
  rateLimitMaxRequests: 1000,
  maxConnections: 50000,
  compressionLevel: 9,
  connectionTimeout: 60000
});

server.start();
```

### Client Configuration

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  namespace: '/chat',
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY,
  apiKey: 'your-api-key',
  reconnectDelay: 2000,
  maxReconnectAttempts: 15,
  ackTimeout: 60000
});

await client.connect();
```

---

## Error Codes

### Connection Errors

```
ERR_CONN_001: Connection refused
  Cause: Server not listening or unreachable
  Solution: Verify server is running, check host/port

ERR_CONN_002: Connection timeout
  Cause: Server not responding within timeout
  Solution: Check network connectivity, increase connectionTimeout

ERR_CONN_003: Handshake failed
  Cause: WebSocket handshake error
  Solution: Verify server is WebSocket-compatible

ERR_CONN_004: Authentication failed
  Cause: Encryption key mismatch or invalid API key
  Solution: Verify encryptionKey matches on client and server

ERR_CONN_005: Max connections exceeded
  Cause: Server at maxConnections limit
  Solution: Increase maxConnections or disconnect unused clients

ERR_CONN_006: Connection lost
  Cause: Network interruption or server disconnect
  Solution: Client will auto-reconnect with exponential backoff
```

### Message Errors

```
ERR_MSG_001: Invalid message format
  Cause: Malformed message structure
  Solution: Check message format, update SmartSocket version

ERR_MSG_002: Decompression failed
  Cause: Corrupted compressed data
  Solution: Check compressionLevel, retry message

ERR_MSG_003: Decryption failed
  Cause: Wrong encryption key or corrupted data
  Solution: Verify encryptionKey matches exactly on both sides

ERR_MSG_004: Message too large
  Cause: Data exceeds maximum size
  Solution: Split message into smaller chunks or enable compression

ERR_MSG_005: Invalid namespace
  Cause: Namespace doesn't exist on server
  Solution: Verify namespace path, create namespace on server
```

### Rate Limiting Errors

```
ERR_RATE_001: Rate limit exceeded
  Cause: Too many requests in time window
  Solution: Wait for window to reset or adjust rate limit settings

ERR_RATE_002: Event rate limit exceeded
  Cause: Specific event rate limit triggered
  Solution: Reduce frequency of specific events
```

### Acknowledgment Errors

```
ERR_ACK_001: Acknowledgment timeout
  Cause: Server didn't respond within ackTimeout
  Solution: Increase ackTimeout or optimize server processing

ERR_ACK_002: Invalid acknowledgment response
  Cause: Malformed ack callback response
  Solution: Ensure callback returns valid response object

ERR_ACK_003: Message not found
  Cause: Ack ID doesn't match any sent message
  Solution: Retry the message or check for duplicate sends
```

---

## Reconnection Settings

### Understanding Reconnection

When client loses connection, it automatically reconnects with exponential backoff:

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  reconnectDelay: 1000,           // Start with 1 second
  maxReconnectAttempts: 10        // Try up to 10 times
});

// Timeline:
// Attempt 0: wait 1s
// Attempt 1: wait 1.5s
// Attempt 2: wait 2.25s
// Attempt 3: wait 3.4s
// ... etc (exponential backoff)
```

### Listening to Reconnection Events

```javascript
client.on('connected', () => {
  console.log('Connected!');
});

client.on('disconnected', () => {
  console.log('Disconnected, will reconnect...');
});

client.on('error', (error) => {
  console.error('Connection error:', error);
});

// Custom: track reconnection attempts
let attempts = 0;
const originalConnect = client.connect.bind(client);
client.connect = async function() {
  try {
    await originalConnect();
    attempts = 0;
  } catch(err) {
    attempts++;
    if (attempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
    }
    throw err;
  }
};
```

---

## Timeout Settings

### Acknowledgment Timeout

```javascript
// Client waits up to 30 seconds for server to respond
const client = new SmartSocketClient('ws://localhost:3000', {
  ackTimeout: 30000  // 30 seconds in milliseconds
});

client.emit('save-data', { name: 'John' }, (ack) => {
  if (ack) {
    console.log('Server responded:', ack);
  } else {
    console.error('Server did not respond in time');
  }
});

// Adjust for slow operations:
const client = new SmartSocketClient('ws://localhost:3000', {
  ackTimeout: 120000  // 2 minutes for long operations
});
```

### Connection Timeout

```javascript
// Server drops connections idle for more than 30 seconds
const server = new SmartSocket({
  connectionTimeout: 30000  // 30 seconds
});

// Adjust for slow networks:
const server = new SmartSocket({
  connectionTimeout: 60000  // 1 minute for slow networks
});
```

---

## Compression Configuration

### Compression Settings

```javascript
// Server
const server = new SmartSocket({
  compressionThreshold: 1024,   // Compress messages > 1KB
  compressionLevel: 6           // 1-9, default 6
});

// Compression levels:
// 1 = Fastest (minimal reduction)
// 6 = Default (balanced)
// 9 = Best compression (slowest)
```

### Compression Ratios

```
Level 1: ~10% reduction, <1ms overhead
Level 6: ~60% reduction, 2-3ms overhead
Level 9: ~75% reduction, 5-10ms overhead

For 5KB message:
  - Uncompressed: 5000 bytes
  - Level 6: ~2000 bytes (60% reduction)
  - Level 9: ~1250 bytes (75% reduction)
```

### Using Compression

```javascript
// Compression is automatic and transparent
// No code changes needed - just enable it

const server = new SmartSocket({
  compressionLevel: 9,
  compressionThreshold: 512  // Compress > 512 bytes
});

// Client doesn't need special config
const client = new SmartSocketClient('ws://localhost:3000');
// Decompression happens automatically
```

---

## Encryption Setup

### Generate Encryption Key

```bash
# Generate 32-byte (256-bit) key in base64
openssl rand -base64 32

# Output example:
# k3mZ7x9pQ2vL8nR5tY1hJ4bF6wS0dA2eK9mX7cP3vN=
```

### Server with Encryption

```javascript
const server = new SmartSocket({
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY,  // Set via env var
  encryptionAlgorithm: 'aes-256-cbc'
});
```

### Client with Encryption

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY   // MUST match server
});

await client.connect();
```

### Key Management Best Practices

```javascript
// DO: Use environment variables
const key = process.env.ENCRYPTION_KEY;

// DO: Use secure vaults (AWS Secrets Manager, HashiCorp Vault, etc.)

// DON'T: Hardcode keys in source code
// const key = 'k3mZ7x9pQ2vL8nR5tY1hJ4bF6wS0dA2eK9mX7cP3vN=';

// DON'T: Commit .env files to git
// Add to .gitignore: .env, .env.local, etc.

// DO: Rotate keys every 90 days
// Generate new key and restart servers
```

---

## Rate Limiting Configuration

### Basic Rate Limiting

```javascript
const server = new SmartSocket({
  enableRateLimiting: true,
  rateLimitWindow: 60000,        // 1 minute window
  rateLimitMaxRequests: 100      // Max 100 requests per minute
});
```

### Per-Event Rate Limiting

```javascript
const server = new SmartSocket({
  enableRateLimiting: true
});

// Stricter limit for specific events
server.setEventRateLimit('message', {
  window: 5000,      // 5 second window
  maxRequests: 5     // Max 5 messages per 5 seconds
});

server.setEventRateLimit('delete', {
  window: 60000,     // 1 minute
  maxRequests: 1     // Only 1 delete per minute
});
```

### Handling Rate Limits

```javascript
// Server side
server.on('rate-limit', (socket) => {
  socket.emit('__rate-limited__', {
    message: 'Too many requests, please slow down',
    retryAfter: 5000  // Retry after 5 seconds
  });
});

// Client side
client.on('__rate-limited__', (info) => {
  console.warn('Rate limited:', info.message);
  setTimeout(() => {
    // Retry the operation
  }, info.retryAfter);
});
```

### Rate Limiting Examples

```
Scenario 1: Chat application
- rateLimitWindow: 5000 (5 seconds)
- rateLimitMaxRequests: 5 (max 5 messages per 5 seconds)

Scenario 2: API-heavy application
- rateLimitWindow: 60000 (1 minute)
- rateLimitMaxRequests: 1000 (max 1000 requests per minute)

Scenario 3: Real-time game
- rateLimitWindow: 1000 (1 second)
- rateLimitMaxRequests: 10 (max 10 actions per second)
```

---

## Connection Pool Configuration

### Pool Settings

```javascript
const server = new SmartSocket({
  enableConnectionPooling: true,
  maxConnections: 10000
});

// The pool optimizes memory usage and connection setup
// No additional configuration needed for basic use
```

### Monitoring Pool Usage

```javascript
// Check statistics regularly
setInterval(() => {
  const stats = server.getStats();
  console.log('Connections:', stats.connections);
  console.log('Memory usage:', stats.memoryUsage);
}, 60000);  // Every minute
```

---

## Debug Logging

### Enable Debug Mode

```javascript
// Set environment variable
process.env.DEBUG = 'smartsocket:*';

// Or in code
const logger = require('smartsocket-client/logger');
logger.setLevel('debug');

// Logging levels:
logger.setLevel('error');    // Only errors
logger.setLevel('warn');     // Warnings + errors
logger.setLevel('info');     // Normal operations
logger.setLevel('debug');    // Detailed debugging
logger.setLevel('trace');    // Very detailed
```

### Expected Log Output

```
[smartsocket] [info] Connecting to ws://localhost:3000
[smartsocket] [debug] WebSocket connection opened
[smartsocket] [debug] Sending CONNECT message
[smartsocket] [debug] Received CONNECT_ACK
[smartsocket] [info] Connected to server
[smartsocket] [debug] Emitting event: message { text: 'Hello' }
[smartsocket] [debug] Sent message (125 bytes)
```

---

## Browser Compatibility

### Supported Browsers

```
Chrome 43+ (2015)
Firefox 48+ (2016)
Safari 10.1+ (2016)
Edge 14+ (2016)
iOS Safari 10.1+
Android Chrome 43+
Android Firefox 48+
Samsung Internet 4+
```

### Checking Browser Support

```javascript
// Check WebSocket support
if (typeof WebSocket === 'undefined') {
  console.error('WebSocket not supported in this browser');
}

// Check binary support
if (typeof ArrayBuffer === 'undefined') {
  console.error('Binary WebSocket not supported');
}

// Conditional initialization
if (typeof WebSocket !== 'undefined') {
  const client = new SmartSocketClient('ws://localhost:3000');
  await client.connect();
} else {
  console.error('Please upgrade your browser');
}
```

### Using Polyfills

```html
<!-- For older browsers -->
<script src="websocket-polyfill.js"></script>

<!-- Then use SmartSocket -->
<script src="SmartSocketClient.js"></script>
```

---

## Performance Tuning

### For Low Latency

```javascript
const server = new SmartSocket({
  compressionLevel: 1,           // Minimal compression
  rateLimitMaxRequests: 10000,   // High limit
  connectionTimeout: 5000        // Short timeout
});
```

### For High Throughput

```javascript
const server = new SmartSocket({
  compressionLevel: 9,           // Maximum compression
  maxConnections: 50000,         // High connection limit
  enableConnectionPooling: true
});
```

### For Mobile Networks

```javascript
const client = new SmartSocketClient('ws://localhost:3000', {
  reconnectDelay: 5000,          // Longer initial delay
  maxReconnectAttempts: 20,      // More attempts
  ackTimeout: 60000              // Longer timeout
});
```

---

## Security Best Practices

### Always Encrypt in Production

```javascript
const server = new SmartSocket({
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY
});

// Use WSS (WebSocket Secure) not WS
const client = new SmartSocketClient('wss://your-domain.com:3000');
```

### Use HTTPS/WSS

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};

const httpsServer = https.createServer(options);
const server = new SmartSocket({
  port: 3000,
  server: httpsServer
});
```

### Validate Input

```javascript
server.on('message', (socket, data, ack) => {
  // Always validate input
  if (!data || typeof data !== 'object') {
    ack({ error: 'Invalid data format' });
    return;
  }
  
  if (!data.text || typeof data.text !== 'string') {
    ack({ error: 'Missing or invalid text field' });
    return;
  }
  
  // Process safe data
  ack({ success: true });
});
```

### Implement Authentication

```javascript
server.on('connected', (socket) => {
  socket.requireAuth = true;
});

socket.on('auth', (credentials, ack) => {
  if (verifyCredentials(credentials)) {
    socket.data.authenticated = true;
    socket.data.userId = credentials.userId;
    ack({ success: true });
  } else {
    ack({ success: false, error: 'Invalid credentials' });
    socket.disconnect();
  }
});

server.use((socket, event, data, next) => {
  if (!socket.data.authenticated) {
    next(new Error('Not authenticated'));
  } else {
    next();
  }
});
```

---

## Memory Usage

### Per-Connection Memory

```
Base socket object: ~1.5 KB
Event listeners (avg 5): ~500 bytes
User data storage: ~2-5 KB
Buffers and state: ~1 KB

Total per connection: ~5-7 KB (plus user data)
```

### Memory Monitoring

```javascript
// Monitor memory usage
setInterval(() => {
  const stats = server.getStats();
  const memMB = parseFloat(stats.memoryUsage);
  
  console.log('Memory:', memMB + 'MB');
  console.log('Connections:', stats.connections);
  
  if (memMB > 1000) {
    console.warn('High memory usage detected');
  }
}, 60000);
```

### Reducing Memory

```javascript
// 1. Limit maxConnections
const server = new SmartSocket({
  maxConnections: 5000  // Don't accept more
});

// 2. Enable connection pooling
const server = new SmartSocket({
  enableConnectionPooling: true
});

// 3. Clean up event listeners
client.off('event-name');

// 4. Disconnect unused clients
client.disconnect();
```

---

## Implementation Checklist

When implementing SmartSocket in your project:

### Initial Setup
- [ ] Install SmartSocket package (`npm install smartsocket`)
- [ ] Review Configuration Options section
- [ ] Choose appropriate compression level
- [ ] Set up encryption keys (if needed)

### Development
- [ ] Enable Debug Logging for development
- [ ] Test with multiple concurrent connections
- [ ] Implement error handling for all error codes
- [ ] Handle reconnection events
- [ ] Test timeout scenarios

### Security
- [ ] Enable encryption with secure keys
- [ ] Use WSS (WebSocket Secure) in production
- [ ] Validate all input data
- [ ] Implement authentication
- [ ] Review Security Best Practices

### Performance
- [ ] Configure rate limiting
- [ ] Tune compression level
- [ ] Monitor memory usage
- [ ] Set appropriate timeouts
- [ ] Test browser compatibility

### Production
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
- [ ] Configure connection timeouts
- [ ] Document configuration choices

---

**Ready to implement SmartSocket!** 🚀
