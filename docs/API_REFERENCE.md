# 📚 API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, no authentication is required. For production deployment, consider implementing:
- API keys
- JWT tokens
- OAuth 2.0

---

## Endpoints

### 1. Execute Order

Execute a new market order with DEX routing.

**Endpoint:** `POST /api/orders/execute`

**Request Body:**

```typescript
{
  tokenIn: string;      // Solana token address (32-44 characters)
  tokenOut: string;     // Solana token address (32-44 characters)
  amountIn: number;     // Amount to swap (must be > 0)
  slippage?: number;    // Slippage tolerance (0.0001 - 0.5, default: 0.01)
  orderType?: string;   // Order type (currently only "market" supported)
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "So11111111111111111111111111111111111111112",
    "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amountIn": 10,
    "slippage": 0.01
  }'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Order created and queued for execution",
  "websocketUrl": "ws://localhost:3000/ws/orders/550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "tokenIn": "So11111111111111111111111111111111111111112",
    "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amountIn": 10,
    "slippage": 0.01,
    "orderType": "market",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Validation Errors (400 Bad Request):**

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid Solana address format for tokenIn",
  "statusCode": 400
}
```

**Possible Validation Errors:**

- Invalid Solana address format (must be 32-44 characters)
- Amount must be greater than 0
- Slippage must be between 0.01% and 50% (0.0001 - 0.5)
- Missing required fields

---

### 2. Get Order by ID

Retrieve detailed information about a specific order.

**Endpoint:** `GET /api/orders/:orderId`

**Path Parameters:**

- `orderId` (string, required) - UUID of the order

**Example Request:**

```bash
curl http://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "market",
    "status": "confirmed",
    "tokenIn": "So11111111111111111111111111111111111111112",
    "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amountIn": 10,
    "amountOut": 9.95,
    "expectedPrice": null,
    "executedPrice": 0.995,
    "slippage": 0.01,
    "dexProvider": "meteora",
    "txHash": "5j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q",
    "errorMessage": null,
    "retryCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:05.000Z",
    "completedAt": "2024-01-15T10:30:05.000Z"
  }
}
```

**Order Not Found (404):**

```json
{
  "success": false,
  "error": "Order not found"
}
```

---

### 3. List Orders

List orders with optional filtering and pagination.

**Endpoint:** `GET /api/orders`

**Query Parameters:**

- `status` (string, optional) - Filter by order status
  - Possible values: `pending`, `routing`, `building`, `submitted`, `confirmed`, `failed`
- `limit` (number, optional) - Number of orders per page (default: 10, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)

**Example Requests:**

```bash
# Get all orders (paginated)
curl "http://localhost:3000/api/orders?limit=10&offset=0"

# Get only confirmed orders
curl "http://localhost:3000/api/orders?status=confirmed&limit=20"

# Get pending orders
curl "http://localhost:3000/api/orders?status=pending"

# Get failed orders
curl "http://localhost:3000/api/orders?status=failed"
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "market",
      "status": "confirmed",
      "tokenIn": "So11111111111111111111111111111111111111112",
      "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amountIn": 10,
      "amountOut": 9.95,
      "executedPrice": 0.995,
      "dexProvider": "meteora",
      "txHash": "5j8k9l...",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:30:05.000Z"
    },
    {
      "id": "660f9500-f3ac-52e5-b827-557766551111",
      "type": "market",
      "status": "confirmed",
      "tokenIn": "So11111111111111111111111111111111111111112",
      "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amountIn": 5,
      "amountOut": 4.97,
      "executedPrice": 0.994,
      "dexProvider": "raydium",
      "txHash": "6k9l0m...",
      "createdAt": "2024-01-15T11:15:00.000Z",
      "completedAt": "2024-01-15T11:15:03.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 2
  }
}
```

---

### 4. Get Order Statistics

Get aggregated statistics about orders.

**Endpoint:** `GET /api/orders/stats`

**Example Request:**

```bash
curl http://localhost:3000/api/orders/stats
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "pending": 5,
    "routing": 2,
    "processing": 2,
    "confirmed": 100,
    "failed": 3,
    "total": 110
  }
}
```

**Field Descriptions:**

- `pending` - Orders waiting in queue
- `routing` - Orders currently comparing DEX prices
- `processing` - Orders being built and submitted (same as `routing`)
- `confirmed` - Successfully executed orders
- `failed` - Orders that failed after max retries
- `total` - Total number of all orders

---

## WebSocket API

### Connect to Order Updates

**Endpoint:** `ws://localhost:3000/ws/orders/:orderId`

**Path Parameters:**

- `orderId` (string, required) - UUID of the order to monitor

**Example (JavaScript):**

```javascript
const orderId = '550e8400-e29b-41d4-a716-446655440000';
const ws = new WebSocket(`ws://localhost:3000/ws/orders/${orderId}`);

ws.onopen = () => {
  console.log('Connected to order updates');
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Order update:', update);
  
  // Handle different status updates
  switch (update.status) {
    case 'routing':
      console.log('Comparing DEX prices...');
      break;
    case 'building':
      console.log('Building transaction...');
      break;
    case 'submitted':
      console.log('Executing swap...');
      break;
    case 'confirmed':
      console.log('Order confirmed!', update.data);
      ws.close(); // Close connection after completion
      break;
    case 'failed':
      console.error('Order failed:', update.data.errorMessage);
      ws.close();
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from order updates');
};
```

**Example (wscat CLI):**

```bash
# Install wscat
npm install -g wscat

# Connect to order updates
wscat -c "ws://localhost:3000/ws/orders/550e8400-e29b-41d4-a716-446655440000"
```

### WebSocket Event Types

#### 1. Status Update - Routing

```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "timestamp": "2024-01-15T10:30:01.000Z",
  "data": {
    "message": "Comparing DEX prices"
  }
}
```

#### 2. Status Update - Building

```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "building",
  "timestamp": "2024-01-15T10:30:02.000Z",
  "data": {
    "message": "Building transaction"
  }
}
```

#### 3. Status Update - Submitted

```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "submitted",
  "timestamp": "2024-01-15T10:30:03.000Z",
  "data": {
    "message": "Executing swap on raydium"
  }
}
```

#### 4. Status Update - Confirmed (Success)

```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "confirmed",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "data": {
    "message": "Transaction confirmed: 5j8k9l...",
    "executedPrice": 0.995,
    "amountOut": 9.95,
    "txHash": "5j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q"
  }
}
```

#### 5. Status Update - Failed (Error)

```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "data": {
    "message": "Order failed: Network error",
    "errorMessage": "Network error",
    "retryCount": 3
  }
}
```

### WebSocket Health Check

**Endpoint:** `GET /ws/health`

**Example Request:**

```bash
curl http://localhost:3000/ws/health
```

**Success Response (200 OK):**

```json
{
  "status": "healthy",
  "connections": 5,
  "activeOrders": 3
}
```

---

## Order Status Flow

Orders progress through the following statuses:

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
                                              ↓
                                           FAILED
                                    (after max retries)
```

**Status Descriptions:**

1. **PENDING** - Order created and waiting in queue
2. **ROUTING** - Comparing prices between Raydium and Meteora
3. **BUILDING** - Constructing the swap transaction
4. **SUBMITTED** - Executing the swap on the selected DEX
5. **CONFIRMED** - Transaction successfully executed
6. **FAILED** - Transaction failed after maximum retry attempts (3)

---

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found (order doesn't exist)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "statusCode": 400
}
```

### Common Errors

#### 1. Invalid Token Address

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid Solana address format for tokenIn",
  "statusCode": 400
}
```

#### 2. Invalid Amount

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Amount must be greater than 0",
  "statusCode": 400
}
```

#### 3. Invalid Slippage

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Slippage must be between 0.0001 and 0.5",
  "statusCode": 400
}
```

#### 4. Order Not Found

```json
{
  "success": false,
  "error": "Order not found",
  "statusCode": 404
}
```

---

## Rate Limiting

- **Queue Rate Limit**: 100 orders per minute
- **Concurrent Workers**: 10 orders processed simultaneously
- **Retry Logic**: Maximum 3 attempts with exponential backoff

If rate limit is exceeded, orders will be queued and processed in order.

---

## Data Types

### Token Addresses

All Solana token addresses must be valid base58-encoded strings between 32-44 characters.

**Common Tokens:**

- **SOL (Wrapped)**: `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **RAY (Raydium)**: `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R`

### Slippage

- **Type**: Number (decimal)
- **Range**: 0.0001 - 0.5 (0.01% - 50%)
- **Default**: 0.01 (1%)
- **Recommended**: 0.005 - 0.02 (0.5% - 2%)

### Order Types

Currently supported:
- **market** - Immediate execution at current market price

Future support (not implemented):
- **limit** - Execute only if price meets specified limit
- **stop** - Trigger order when price reaches stop price

---

## Testing with Postman

Import the Postman collection from `postman_collection.json`:

1. Open Postman
2. Click "Import"
3. Select `postman_collection.json`
4. Collection includes:
   - All API endpoints with examples
   - Validation test cases
   - Pre-configured environment variables
   - Automated response tests

---

## Testing with curl

### Complete Flow Example

```bash
# 1. Execute an order
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "So11111111111111111111111111111111111111112",
    "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amountIn": 10,
    "slippage": 0.01
  }')

echo "Order Response: $ORDER_RESPONSE"

# 2. Extract order ID
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId')
echo "Order ID: $ORDER_ID"

# 3. Wait a few seconds for processing
sleep 5

# 4. Check order status
curl "http://localhost:3000/api/orders/$ORDER_ID" | jq

# 5. Get all orders
curl "http://localhost:3000/api/orders" | jq

# 6. Get statistics
curl "http://localhost:3000/api/orders/stats" | jq
```

---

## SDKs and Client Libraries

### JavaScript/TypeScript Example

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

// Execute order
async function executeOrder(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  slippage: number = 0.01
) {
  try {
    const response = await axios.post(`${API_BASE}/api/orders/execute`, {
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data);
    }
    throw error;
  }
}

// Get order by ID
async function getOrder(orderId: string) {
  const response = await axios.get(`${API_BASE}/api/orders/${orderId}`);
  return response.data;
}

// List orders
async function listOrders(status?: string, limit: number = 10, offset: number = 0) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  
  const response = await axios.get(`${API_BASE}/api/orders?${params}`);
  return response.data;
}

// Get statistics
async function getStats() {
  const response = await axios.get(`${API_BASE}/api/orders/stats`);
  return response.data;
}

// Usage
const result = await executeOrder(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  10,
  0.01
);

console.log('Order ID:', result.orderId);
console.log('WebSocket URL:', result.websocketUrl);
```

---

## Next Steps

For production deployment, consider implementing:

1. **Authentication** - API keys, JWT tokens, or OAuth
2. **Rate Limiting** - Per-user rate limits
3. **Monitoring** - APM tools (DataDog, New Relic)
4. **Alerting** - Error notifications via email/Slack
5. **Caching** - Redis caching for frequently accessed orders
6. **Database Scaling** - Read replicas, connection pooling
7. **Load Balancing** - Multiple server instances
8. **HTTPS** - SSL/TLS certificates for secure communication
