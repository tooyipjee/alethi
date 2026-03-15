# Pan App - Phased Development Roadmap

## Current Problems

1. **Sync conversations are incoherent** - Multiple unrelated requests get merged
2. **No real follow-through** - Pan promises to follow up but never does
3. **No real-time visibility** - User can't see what's happening as it happens
4. **Testing is inadequate** - We test units, not user flows

---

## Phase 1: Single-Turn Sync (Foundation)

**Goal**: One user asks their Pan to contact another Pan, and gets a response back.

### What it should do:
1. User asks: "Ask Sarah what she's working on"
2. Nova (user's Pan) sends ONE message to Luna (Sarah's Pan)
3. Luna responds with ONE message
4. Nova reports back to the user with Luna's response
5. User sees the full exchange

### Testable acceptance criteria:
- [ ] Sync creates exactly 2 messages (request + response)
- [ ] Nova's final message to user contains Luna's actual response
- [ ] Exchange is visible in Pan Syncs immediately
- [ ] Both users can see the same exchange

### Technical requirements:
- Clear separation between "user chat" and "pan-to-pan sync"
- Sync must complete before Nova responds to user
- No streaming partial responses during sync

---

## Phase 2: Multi-Turn Negotiation

**Goal**: Pans can have back-and-forth to reach agreement.

### What it should do:
1. User asks: "Schedule a meeting with Sarah for next week"
2. Nova proposes times to Luna
3. Luna counter-proposes based on Sarah's calendar
4. They go back and forth (max 4 turns)
5. Agreement or impasse is reached
6. User gets notified of outcome

### Testable acceptance criteria:
- [ ] Maximum turn limit enforced (no infinite loops)
- [ ] Each turn has clear intent (propose/counter/accept/decline)
- [ ] Final outcome is clearly communicated to both users
- [ ] Conversation stays on-topic (no random tangents)

### Technical requirements:
- Turn-based state machine
- Intent classification per message
- Topic coherence checking

---

## Phase 3: Real-Time Visibility

**Goal**: Users can watch the sync happen live.

### What it should do:
1. User initiates a sync
2. UI shows "syncing..." with live message stream
3. Each message appears as it's generated
4. Completion is clearly indicated

### Testable acceptance criteria:
- [ ] Messages appear within 500ms of generation
- [ ] UI updates without page refresh
- [ ] Both parties see updates simultaneously
- [ ] Clear visual distinction between "in progress" and "complete"

### Technical requirements:
- SSE or WebSocket for real-time updates
- Optimistic UI updates
- Connection recovery on disconnect

---

## Phase 4: Follow-Up & Callbacks

**Goal**: Pan can promise to follow up and actually do it.

### What it should do:
1. User asks: "Let me know when Sarah responds"
2. Nova schedules a callback
3. When Luna responds, Nova notifies the user
4. Works even if user navigates away

### Testable acceptance criteria:
- [ ] Callbacks persist across page refreshes
- [ ] User gets notification when callback fires
- [ ] Callbacks can be cancelled
- [ ] Old callbacks expire after 24h

### Technical requirements:
- Background job/polling system
- Notification delivery (in-app, push, or both)
- Callback storage and lifecycle management

---

## Phase 5: Multi-User Live Demo

**Goal**: Two real users can log in and interact through their Pans.

### What it should do:
1. Alex logs in on Device A
2. Sarah logs in on Device B
3. Alex asks Nova to contact Sarah
4. Sarah sees the request from Luna
5. Sarah can respond through Luna
6. Alex sees Sarah's response

### Testable acceptance criteria:
- [ ] Two simultaneous sessions work correctly
- [ ] No cross-user data leakage
- [ ] Both users see consistent state
- [ ] Works across different browsers

### Technical requirements:
- Session isolation
- Real-time sync across clients
- Privacy controls enforced

---

## Testing Strategy

### Per-Phase Testing:
1. **Unit tests**: Individual functions work
2. **Integration tests**: Components work together
3. **E2E tests**: Full user flow works
4. **Manual smoke test**: Actually use it yourself

### E2E Test Script (Phase 1):
```
1. Open browser, login as alex@pan.local
2. Go to Hub
3. Type: "Ask Sarah what she's working on"
4. Wait for response (max 30s)
5. Verify: Nova's response mentions Sarah's actual context
6. Go to Pan Syncs
7. Verify: New sync exists with exactly 2 messages
8. Open incognito, login as sarah@pan.local
9. Go to Pan Syncs
10. Verify: Same sync visible with same messages
```

---

## Priority Order

1. **Phase 1** - This is broken and fundamental
2. **Phase 3** - Users need to see what's happening
3. **Phase 2** - Multi-turn is secondary to basic functionality
4. **Phase 5** - Demo readiness
5. **Phase 4** - Nice to have, complex

---

## Next Steps

Start with Phase 1:
1. Audit current negotiation flow
2. Identify where it's creating multiple syncs or merging topics
3. Simplify to single request-response
4. Add E2E test to verify
5. Ship and manually test
