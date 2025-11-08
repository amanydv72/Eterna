# Complete Order Execution Flow - Technical Specification

## Architecture Overview

The order execution system follows a modern microservices-inspired architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  (HTTP Client, WebSocket Client)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  • Fastify HTTP Server                                         │
│  • Request Validation (TypeBox Schemas)                        │
│  • Response Formatting                                          │
│  • Error Handling                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ OrderService │  │  DexService  │  │ CacheService │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Queue Layer                                │
│  • BullMQ Job Queue                                            │
│  • Worker Pool (10 concurrent)                                 │
│  • Rate Limiting (100/min)                                     │
│  • Retry Logic (exponential backoff)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  DEX Router  │  │ Swap Executor│  │  Validator   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │     Redis    │  │   Drizzle    │         │
│  │  (Orders DB) │  │   (Cache)    │  │     ORM      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  WebSocket Layer                                │
│  • Real-time Status Broadcasting                               │
│  • Connection Management                                        │
│  • Room-based Messaging                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### 1. Order Submission Flow

```typescript
// Client -> API
POST /api/orders/execute
{
tokenIn: "So11111111111111111111111111111111111111112",
tokenOut: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
amountIn: 10,
slippage: 0.01
}

// API -> Service
orderService.validateOrder(orderData)
orderService.createOrder(orderData)

// Service -> Database
orderRepository.createOrder(newOrderRecord)
// Status: PENDING

// Service -> Queue
addOrderToQueue(orderId, orderData)

// API -> Client
{
success: true,
orderId: "order_abc123",
status: "pending",
websocketUrl: "ws://localhost:3000/ws/orders/order_abc123"
}
```

### 2. Queue Processing Flow

```typescript
// Queue -> Worker
processOrder(job: Job<OrderJobData>)

// Worker -> Database (Update Status)
updateOrderStatus(orderId, OrderStatus.ROUTING, "Comparing DEX prices")

// Worker -> WebSocket
wsManager.broadcastStatusUpdate({
orderId,
status: OrderStatus.ROUTING,
timestamp: new Date(),
data: { message: "Comparing DEX prices" }
})

// Worker -> DEX Service
const { quote, decision } = await dexService.getRoutingDecision(
orderId,
tokenIn,
tokenOut,
amountIn
)
// Returns: Best DEX (Raydium/Meteora) with reasoning

// Worker -> Database (Update Status)
updateOrderStatus(orderId, OrderStatus.BUILDING, "Building transaction")

// Worker -> WebSocket
wsManager.broadcastStatusUpdate({
orderId,
status: OrderStatus.BUILDING,
timestamp: new Date()
})

// Worker -> Swap Executor
const result = await swapExecutor.execute({
orderId,
dexProvider: decision.selectedProvider,
tokenIn,
tokenOut,
amountIn,
expectedPrice: quote.price,
slippage
})
// Simulates 2-3s transaction execution

// Worker -> Database (Update Status)
updateOrderStatus(orderId, OrderStatus.SUBMITTED, "Executing swap")

// Worker -> WebSocket
wsManager.broadcastStatusUpdate({
orderId,
status: OrderStatus.SUBMITTED,
timestamp: new Date()
})

// After execution completes...

// Worker -> Database (Final Update)
orderRepository.updateExecution(orderId, {
executedPrice: result.executedPrice,
amountOut: result.amountOut,
dexProvider: decision.selectedProvider,
txHash: result.txHash
})
// Status: CONFIRMED

// Worker -> Cache
cacheService.updateCachedOrderStatus(orderId, {
status: OrderStatus.CONFIRMED,
executedPrice: result.executedPrice,
txHash: result.txHash
})

// Worker -> WebSocket (Final Broadcast)
wsManager.broadcastStatusUpdate({
orderId,
status: OrderStatus.CONFIRMED,
timestamp: new Date(),
data: {
    message: `Transaction confirmed: ${result.txHash}`,
    executedPrice: result.executedPrice,
    amountOut: result.amountOut,
    txHash: result.txHash
}
})
```

### 3. Error Handling Flow

```typescript
// If error occurs during processing...

try {
// ... execution logic
} catch (error) {
// Check retry count
if (attemptNumber < MAX_RETRIES) {
    // Calculate backoff delay
    const delay = calculateBackoff(attemptNumber)
    
    // Re-throw to trigger BullMQ retry
    throw error
} else {
    // Max retries exceeded
    
    // Worker -> Database (Mark Failed)
    orderRepository.markFailed(
      orderId,
      error.message,
      attemptNumber + 1
    )
    
    // Worker -> Cache
    cacheService.updateCachedOrderStatus(orderId, {
      status: OrderStatus.FAILED,
      errorMessage: error.message
    })
    
    // Worker -> WebSocket
    wsManager.broadcastStatusUpdate({
      orderId,
      status: OrderStatus.FAILED,
      timestamp: new Date(),
      data: {
        message: `Order failed: ${error.message}`,
        errorMessage: error.message,
        retryCount: attemptNumber + 1
      }
    })
}
}
```

## State Machine

```
PENDING ──-> ROUTING ──-> BUILDING ──-> SUBMITTED ──-> CONFIRMED
                │            │            │
                │            │            │
                └────────────┴────────────┴──────-> FAILED
                                                (after max retries)
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Order Validation | < 50ms | Synchronous validation |
| Database Write | < 50ms | Single insert operation |
| Queue Add | < 10ms | Redis operation |
| DEX Quote Fetch | ~200-300ms | Parallel requests to 2 DEXs |
| Transaction Simulation | 2-3s | Mock on-chain execution |
| WebSocket Broadcast | < 5ms | In-memory operation |
| **Total Time** | **~3-4s** | Submission to confirmation |
| Throughput | 100 orders/min | Rate limited |
| Concurrent Workers | 10 | Configurable |

## Data Persistence

### Database Schema (PostgreSQL)
```sql
orders (
id UUID PRIMARY KEY,
type VARCHAR(20) NOT NULL,
status VARCHAR(20) DEFAULT 'pending',
token_in VARCHAR(100) NOT NULL,
token_out VARCHAR(100) NOT NULL,
amount_in DECIMAL(20,8) NOT NULL,
amount_out DECIMAL(20,8),
expected_price DECIMAL(20,8),
executed_price DECIMAL(20,8),
slippage DECIMAL(5,4) DEFAULT 0.01,
dex_provider VARCHAR(20),
tx_hash VARCHAR(200),
error_message TEXT,
retry_count INTEGER DEFAULT 0,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP
)
```

### Cache Schema (Redis)
```
order:{orderId}:status -> JSON object with latest status
order:{orderId}:active -> Boolean flag
status_update:{orderId}:{timestamp} -> Status update event
```

### Queue Schema (BullMQ/Redis)
```
bull:order-execution:waiting -> List of pending jobs
bull:order-execution:active -> Set of processing jobs
bull:order-execution:completed -> Sorted set of completed jobs
bull:order-execution:failed -> Sorted set of failed jobs
```

## Security & Validation

1. **Input Validation**
- Solana address format (32-44 characters)
- Amount > 0
- Slippage: 0.01% - 50%

2. **Rate Limiting**
- 100 orders per minute per queue
- Configurable per environment

3. **Retry Strategy**
- Max 3 attempts
- Exponential backoff: 1s, 2s, 4s
- Random jitter to prevent thundering herd

4. **Error Boundaries**
- Try-catch at each layer
- Graceful degradation
- Comprehensive logging

## Monitoring & Observability

All events are logged with structured JSON including:
- Correlation IDs (orderId)
- Timestamps
- Status transitions
- Performance metrics
- Error details

Example log:
```json
{
"level": "info",
"time": 1699401234567,
"pid": 12345,
"hostname": "worker-1",
"orderId": "order_abc123",
"status": "confirmed",
"dexProvider": "raydium",
"executedPrice": "0.995",
"amountOut": "9.95",
"txHash": "abc123...",
"duration": "3247ms",
"msg": "Order executed successfully"
}
```

## Testing Strategy

1. **Unit Tests** (35 tests)
- Individual component testing
- Mock external dependencies

2. **Integration Tests** (Phase 7)
- End-to-end flow testing
- Real database and queue

3. **Load Tests** (Future)
- Stress test queue throughput
- Measure system limits

4. **Chaos Tests** (Future)
- Network failures
- Database downtime
- Redis unavailability
