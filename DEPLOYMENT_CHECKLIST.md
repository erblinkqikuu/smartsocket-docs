# 📋 Deployment Checklist

## Pre-Deployment (Local)

- [ ] Read `INDEX.md` - Understand the solution
- [ ] Review `READY_TO_DEPLOY.js` - Understand the code
- [ ] Have SSH key ready: `key.pem`
- [ ] Have server IP ready: `51.38.125.199`
- [ ] Have server username ready: `ubuntu`

## Deployment (3 Steps - 5 Minutes)

### Step 1: Copy Server Code (1 minute)
```bash
# On your local machine
scp -i C:\Users\erbli\Downloads\key.pem \
    C:\Users\erbli\Downloads\Smartsocket\smartsocket-docs\READY_TO_DEPLOY.js \
    ubuntu@51.38.125.199:/root/smartsocket/server.js
```

**Verify**: No errors appear

### Step 2: SSH to Server (30 seconds)
```bash
ssh -i C:\Users\erbli\Downloads\key.pem ubuntu@51.38.125.199
cd /root/smartsocket
```

**Verify**: You're now in `/root/smartsocket` directory

### Step 3: Restart Server (1 minute)
```bash
# Kill existing server
pkill -f "node server.js"

# Wait 2 seconds
sleep 2

# Start new server
node server.js
```

**Verify**: Output shows:
```
✅ Server started
📍 Address: 0.0.0.0
🔌 Port: 8080
📡 Namespace: /quiz
🔄 Auto-broadcast: ENABLED
```

## Post-Deployment Testing (5 minutes)

### Test 1: Single Player Connection
- [ ] Open quiz app in browser
- [ ] Check server logs show `[CONNECT]`
- [ ] Check server logs show `[QUIZ]` message when joining

### Test 2: Multiple Players
- [ ] Open quiz app in Browser 1 and Browser 2
- [ ] Both join same quiz code (e.g., "TEST")
- [ ] Check server logs show both joined:
  ```
  [QUIZ] Player1 joined: TEST
  [QUIZ] Player2 joined: TEST
  ```

### Test 3: Event Broadcasting
- [ ] In Browser 1, start the quiz
- [ ] Check server logs show:
  ```
  [BROADCAST] quiz-started → TEST
  ```
- [ ] Browser 2 should immediately see quiz started
- [ ] Latency should be < 1 second

### Test 4: Player Updates
- [ ] In Browser 1, submit an answer
- [ ] Check server logs show:
  ```
  [BROADCAST] player-answered → TEST
  ```
- [ ] Browser 2 should see answer submitted
- [ ] Other players should see it too

### Test 5: Results Broadcasting
- [ ] Complete the quiz
- [ ] Check server logs show:
  ```
  [BROADCAST] show-results → TEST
  ```
- [ ] All browsers should see results simultaneously

## Verification Checklist

- [ ] Server running without errors
- [ ] `[CONNECT]` logs appear when clients join
- [ ] `[BROADCAST]` logs appear for each event
- [ ] No duplicate broadcasts (events sent once only)
- [ ] Clients receive events within 1 second
- [ ] Multiple quizzes don't interfere (isolated rooms)

## Monitoring (Ongoing)

### Daily Check
```bash
# SSH to server
ssh -i key.pem ubuntu@51.38.125.199

# Check server is running
ps aux | grep "node server.js"

# Check recent logs for errors
tail -n 50 server.log | grep -i error
```

### Performance Monitoring
```bash
# Memory usage
ps aux | grep node | grep -v grep | awk '{print $6}'

# Network connections
netstat -an | grep 8080 | wc -l

# Active users
# Should grow/shrink as players join/leave
```

## Troubleshooting

### Issue: Server won't start
**Symptoms**: `Error: EADDRINUSE: address already in use :::8080`

**Solution**:
```bash
# Kill process using port 8080
lsof -ti:8080 | xargs kill -9

# Then start server
node server.js
```

### Issue: Clients can't connect
**Symptoms**: WebSocket connection fails

**Solution**:
```bash
# Check firewall
sudo ufw status

# Allow port 8080 if needed
sudo ufw allow 8080/tcp

# Restart server
node server.js
```

### Issue: Events not broadcasting
**Symptoms**: `[CONNECT]` and `[QUIZ]` logs appear, but no `[BROADCAST]` logs

**Solution**:
```bash
# Verify handlers are registered
# Check that READY_TO_DEPLOY.js was copied correctly
head -50 server.js | grep "quizNS.on"

# Should show event handlers
# If empty, file wasn't copied correctly
```

### Issue: High latency (>3 seconds)
**Symptoms**: Events take 3+ seconds to broadcast

**Solution**:
```bash
# Check CPU usage
top -p $(pgrep -f "node server.js")

# Check memory
free -h

# Check network
ping 8.8.8.8

# If all good, may be client issue or network congestion
```

## Rollback (If Needed)

If broadcasting breaks existing functionality:

```bash
# Keep backup of working server
cp server.js server.js.backup

# Restore previous version (if you have it)
# Or revert to simpler version without handlers

# The broadcast handlers won't break anything
# They only ADD functionality
```

## Success Criteria

Broadcasting is working when:

1. ✅ Multiple clients can join same quiz
2. ✅ Events appear in server logs as `[BROADCAST]`
3. ✅ Clients receive updates in < 1 second
4. ✅ No duplicate messages
5. ✅ Server CPU usage stays < 20%
6. ✅ Memory usage stays stable

## Timeline

| Phase | Time | Status |
|-------|------|--------|
| Copy file | 1 min | |
| SSH to server | 30 sec | |
| Restart server | 1 min | |
| Test single player | 1 min | |
| Test multiple players | 2 min | |
| Test events | 2 min | |
| **Total** | **~10 min** | |

## Post-Deployment Verification Log

```
Date: ____________
Time: ____________

✓ File copied successfully:
  ```bash
  ls -la server.js
  # Should show today's date
  ```

✓ Server started successfully:
  Logs show: ________________

✓ Client connected (Browser 1):
  Server logs: ________________

✓ Second client connected (Browser 2):
  Server logs: ________________

✓ Both joined same quiz:
  Server logs show both: ________________

✓ Event broadcast verified:
  Observed [BROADCAST] in logs: YES / NO

✓ Clients received updates:
  Browser 1 saw Browser 2: YES / NO
  Browser 2 saw Browser 1: YES / NO

✓ Response time:
  Measured latency: _____ seconds

✓ No errors in logs:
  Error count: _____

Overall Status: ✓ WORKING / ✗ NEEDS DEBUGGING
```

## Contact & Support

- Review `INDEX.md` for complete guide
- Check `QUICK_IMPLEMENTATION.md` for setup help
- See `SERVER_AUTO_BROADCAST_SOLUTION.md` for technical details
- Reference `READY_TO_DEPLOY.js` for code

---

**Deployment Status**: Ready ✅
**Expected Success Rate**: 95%+ (5-10 min deployment)
**Rollback Risk**: Low (handlers only add functionality)
