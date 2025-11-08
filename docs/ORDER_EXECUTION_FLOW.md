# Order Execution Flow

This document describes the complete end-to-end flow of order execution in the system.

## Flow Diagram

```
Client Request
     ↓
[POST /api/orders/execute]
     ↓
Order Validation
     ↓
Database: Create Order (PENDING)
     ↓
Queue: Add to BullMQ
     ↓
Worker: Process Order
     ├─→ Status: ROUTING → WebSocket Broadcast
     ├─→ DEX Router: Get Best Quote
     ├─→ Status: BUILDING → WebSocket Broadcast
     ├─→ Build Transaction
     ├─→ Status: SUBMITTED → WebSocket Broadcast
     ├─→ Execute Swap
     ├─→ Status: CONFIRMED → WebSocket Broadcast
     └─→ Update Database
     ↓
Client Receives Updates via WebSocket
```

## Detailed Flow

### 1. **Order Submission** (API Layer)
- **Endpoint**: `POST /api/orders/execute`
- **Input**: `{ tokenIn, tokenOut, amountIn, slippage }`
- **Actions**:
  - Validate order data (Solana addresses, amounts, slippage)
  - Generate unique order ID
  - Create order in database with status `PENDING`
  - Add order to BullMQ queue
  - Return order ID and WebSocket URL to client

### 2. **Queue Processing** (Worker Layer)
- **Worker**: BullMQ Worker (10 concurrent, 100 orders/min rate limit)
- **Retry Logic**: Exponential backoff (max 3 attempts)
- **Flow**:
  ```
  1. PENDING → ROUTING
  2. ROUTING → BUILDING
  3. BUILDING → SUBMITTED
  4. SUBMITTED → CONFIRMED (success) or FAILED (error)
  ```

### 3. **DEX Routing** (DEX Service Layer)
- **Action**: Compare Raydium vs Meteora
- **Decision Factors**:
  - Output amount
  - Fee structure (Raydium: 0.3%, Meteora: 0.2%)
  - Price impact
  - Slippage tolerance
- **Output**: Best DEX selection with routing reason

### 4. **Swap Execution** (Mock Execution Layer)
- **Simulate**: 2-3 second transaction time
- **Generate**: Mock transaction hash
- **Calculate**:
  - Executed price
  - Actual slippage
  - Gas used
  - Output amount

### 5. **Status Broadcasting** (WebSocket Layer)
- **On Each Status Change**:
  - Update database
  - Cache in Redis
  - Broadcast to all connected WebSocket clients
- **Message Format**:
  ```json
  {
    "type": "status_update",
    "orderId": "order_123",
    "status": "routing",
    "timestamp": "2025-11-08T...",
    "message": "Comparing DEX prices"
  }
  ```

### 6. **Error Handling**
- **Validation Errors**: Return 400 immediately
- **Execution Errors**:
  - Retry up to 3 times with exponential backoff
  - After max retries: Mark as FAILED
  - Broadcast failure status via WebSocket
  - Store error message in database

## Integration Points

### Components Working Together:

1. **API → Queue**
   - `POST /api/orders/execute` → `addOrderToQueue()`

2. **Queue → Worker**
   - BullMQ triggers `processOrder()` function

3. **Worker → DEX Service**
   - `dexService.getRoutingDecision()` → Best DEX selection

4. **Worker → Swap Executor**
   - `swapExecutor.execute()` → Transaction execution

5. **Worker → Database**
   - `orderRepository.updateStatus()` → Persist state
   - `orderRepository.updateExecution()` → Store results

6. **Worker → WebSocket**
   - `wsManager.broadcastStatusUpdate()` → Real-time updates

7. **Worker → Cache**
   - `cacheService.updateCachedOrderStatus()` → Fast retrieval

## Data Flow Example

**User Request**:
```json
POST /api/orders/execute
{
  "tokenIn": "So11111111111111111111111111111111111111112",
  "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amountIn": 10,
  "slippage": 0.01
}
```

**Immediate Response**:
```json
{
  "success": true,
  "orderId": "order_abc123",
  "status": "pending",
  "websocketUrl": "ws://localhost:3000/ws/orders/order_abc123"
}
```

**WebSocket Updates** (received over time):
```json
// Update 1 (after ~0.5s)
{ "type": "status_update", "status": "routing", "message": "Comparing DEX prices" }

// Update 2 (after ~1s)
{ "type": "status_update", "status": "building", "message": "Building transaction" }

// Update 3 (after ~1.5s)
{ "type": "status_update", "status": "submitted", "message": "Executing swap on raydium" }

// Update 4 (after ~4s)
{ 
  "type": "status_update", 
  "status": "confirmed", 
  "message": "Transaction confirmed: abc123...",
  "executedPrice": "0.995",
  "amountOut": "9.95",
  "txHash": "abc123..."
}
```

## Performance Characteristics

- **Order Submission**: < 100ms (database write + queue add)
- **DEX Routing**: ~200-300ms (parallel quote fetching)
- **Transaction Execution**: 2-3s (simulated on-chain time)
- **Total Time**: ~3-4s from submission to confirmation
- **Throughput**: Up to 100 orders/minute (rate limited)
- **Concurrency**: 10 parallel workers

## Monitoring & Observability

All operations are logged with structured JSON:
- Order submission events
- Status transitions
- DEX routing decisions
- Execution results
- Error conditions
- WebSocket connections/disconnections

## Testing Strategy

The complete flow is tested at multiple levels:
1. **Unit Tests**: Individual components (DEX, queue, WebSocket)
2. **Integration Tests**: End-to-end order execution
3. **Load Tests**: Queue performance under load
4. **Error Tests**: Retry logic and failure scenarios
