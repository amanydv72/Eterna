# Order Execution Engine

> DEX order execution engine with WebSocket status updates and intelligent routing

## 🎯 Overview

A production-ready order execution engine that processes market orders with DEX routing across Raydium and Meteora, real-time WebSocket status updates, and robust queue management.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Order Type Selection](#order-type-selection)
- [Deployment](#deployment)
- [Testing](#testing)
- [Demo](#demo)

## ✨ Features

- **Market Order Execution** - Immediate execution at best available price
- **Intelligent DEX Routing** - Automatic price comparison between Raydium and Meteora
- **Real-time WebSocket Updates** - Live order status streaming (6 states)
- **Queue Management** - BullMQ with 10 concurrent orders, 100 orders/min rate limit
- **Retry Logic** - Exponential backoff with max 3 attempts
- **Slippage Protection** - Configurable slippage tolerance
- **Persistent Storage** - PostgreSQL for order history, Redis for active orders

## 🏗️ Architecture

```
Client Request (POST) → API Validation → BullMQ Queue
                                              ↓
WebSocket Upgrade ← Status Updates ← Order Processor
                                              ↓
                                    DEX Router (Raydium vs Meteora)
                                              ↓
                                    Swap Execution → PostgreSQL
```

### Order Status Flow

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
                                              ↓
                                           FAILED (on error)
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify 4.x (HTTP + WebSocket)
- **Queue**: BullMQ 5.x + Redis
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Testing**: Jest
- **Logging**: Pino

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 16
- Redis 7
- Docker (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd order-execution-engine
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker**
```bash
docker-compose up -d
```

5. **Run database migrations**
```bash
npm run migration:generate
npm run migration:run
```

6. **Start development server**
```bash
npm run dev
```

The server will be running at `http://localhost:3000`

## 📖 API Documentation

### Execute Order

**POST** `/api/orders/execute`

Submit a new market order for execution.

**Request Body:**
```json
{
  "type": "market",
  "tokenIn": "So11111111111111111111111111111111111111112",
  "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amountIn": 1.5,
  "slippage": 0.01
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Order queued successfully"
}
```

**WebSocket Updates:**

The connection automatically upgrades to WebSocket after order submission. You'll receive real-time status updates:

```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "message": "Comparing DEX prices...",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

### Get Order Details

**GET** `/api/orders/:id`

Retrieve details of a specific order.

### List Orders

**GET** `/api/orders?status=confirmed&limit=10`

Retrieve order history with optional filters.

## 🎯 Order Type Selection & Design Decisions

### Why Market Orders?

**✅ Chosen**: Market Order

**Decision Rationale:**

1. **Fundamental Use Case** (Primary Reason)
   - Most common order type in DEX trading
   - Demonstrates core execution flow completely
   - Foundation for other order types

2. **Immediate Execution** (Technical Benefit)
   - Tests full DEX routing pipeline end-to-end
   - No price monitoring overhead
   - Simpler state management

3. **Real-time Showcase** (Demo Value)
   - Best demonstrates WebSocket updates
   - Rapid state transitions (6 states in 2-3 seconds)
   - Shows concurrent processing clearly

4. **Production Readiness** (Practical)
   - Most DEX volume is market orders
   - Easier to test and validate
   - Lower complexity, higher reliability

### Key Design Decisions

#### 1. **BullMQ for Queue Management**

**Why BullMQ?**
- ✅ Production-grade, battle-tested
- ✅ Built-in concurrency control (10 workers)
- ✅ Native rate limiting (100/min)
- ✅ Exponential backoff retry
- ✅ Job persistence (survives crashes)
- ✅ Distributed worker support

**Alternatives Considered:**
- ❌ `bull` - Deprecated, no longer maintained
- ❌ `agenda` - Less features, MongoDB dependency
- ❌ `bee-queue` - Simpler, lacks retry features

#### 2. **Fastify over Express**

**Why Fastify?**
- ✅ 2x faster than Express
- ✅ Built-in TypeScript support
- ✅ Native WebSocket plugin
- ✅ Schema validation (TypeBox)
- ✅ Better async/await handling
- ✅ Logging built-in (Pino)

#### 3. **PostgreSQL + Redis Architecture**

**Why This Combination?**
- **PostgreSQL**: Persistent order history, ACID compliance
- **Redis**: Fast cache for active orders, queue backend
- ✅ Best of both worlds
- ✅ Scalable architecture
- ✅ Industry standard

#### 4. **Drizzle ORM**

**Why Drizzle?**
- ✅ TypeScript-first
- ✅ Zero runtime overhead
- ✅ SQL-like syntax
- ✅ Type-safe queries
- ✅ Easy migrations

**vs Prisma:**
- ⚡ Faster (no query engine)
- 📦 Smaller bundle size
- 🎯 More control over SQL

#### 5. **6-State Order Lifecycle**

**Why 6 States?**
```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED/FAILED
```

- ✅ Granular progress tracking
- ✅ Clear debugging
- ✅ Better user experience
- ✅ Matches blockchain transaction flow

#### 6. **WSOL Handler Design**

**Why Automatic Wrapping?**
- ✅ Better UX (users don't need to know about WSOL)
- ✅ Backward compatible (accepts both SOL & WSOL)
- ✅ Prevents invalid swaps (SOL↔WSOL validation)
- ✅ Transparent conversion logging

**Implementation:**
- Normalization layer before DEX routing
- Validation prevents same-asset swaps
- Metadata tracking for transparency

#### 7. **Mock DEX Implementation**

**Current State:** Mock services for development

**Why Mock?**
- ✅ No mainnet costs during development
- ✅ Deterministic testing
- ✅ Faster development cycle
- ✅ Demonstrates architecture

**Production Path:**
- Integrate Jupiter Aggregator (Solana)
- Add 1inch for multi-chain support
- Implement real transaction signing
- Add MEV protection

### Extension Strategy for Other Order Types

#### **Limit Orders** (1-2 weeks)
```typescript
// Monitor price until target reached
interface LimitOrder extends Order {
  targetPrice: number;
  expiresAt: Date;
}

// Implementation:
// 1. Add price monitoring service
// 2. Watch DEX pool updates
// 3. Trigger execution when price >= targetPrice
// 4. Priority queue for triggered orders
```

#### **Sniper Orders** (2-3 weeks)
```typescript
// Execute on token launch/liquidity event
interface SniperOrder extends Order {
  tokenMint: string;
  launchCondition: 'token_creation' | 'liquidity_added';
  maxSlippage: number;
}

// Implementation:
// 1. Monitor Solana program logs
// 2. Detect new token creation events
// 3. Front-run other buyers (MEV-aware)
// 4. Gas optimization for speed
```

### Architecture Scalability

**Current Capacity:**
- 10 concurrent orders
- 100 orders/minute
- Single server deployment

**Scale to 1000 orders/min:**
- Add horizontal scaling (multiple workers)
- Redis Cluster for queue
- PostgreSQL read replicas
- Load balancer (Nginx)

**Scale to 10,000 orders/min:**
- Microservices architecture
- Kafka for event streaming
- Separate routing service
- CDN for static assets

## 📊 Testing & Quality Assurance

### Test Suite

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test Coverage:** 84.74% (300/354 statements)

**Test Results:**
- ✅ 6 test suites passed
- ✅ 35 tests passed
- ✅ 1 skipped
- ✅ 0 failed

**Test Breakdown:**

1. **API Tests** (5 tests)
   - Order creation and queuing
   - Get order by ID
   - List orders with pagination
   - Order statistics

2. **DEX Routing Tests** (5 tests)
   - Dual DEX quote fetching (Raydium + Meteora)
   - Price comparison logic
   - Best route selection
   - Routing decision transparency

3. **Queue Tests** (4 tests)
   - Add orders to queue
   - Idempotency verification
   - Queue statistics

4. **Retry Logic Tests** (4 tests)
   - Exponential backoff calculation
   - Maximum delay enforcement
   - Jitter addition (prevent thundering herd)

5. **Swap Execution Tests** (6 tests)
   - DEX swap execution
   - Execution delay simulation
   - Gas usage tracking
   - Slippage validation

6. **WebSocket Tests** (11 tests)
   - Connection management
   - Status broadcasting
   - Multiple client support
   - Connection cleanup
   - Error handling

### Postman Collection

**Import Collection:** `postman_collection.json`

**Features:**
- ✅ 40+ API test cases
- ✅ Automated test scripts
- ✅ Environment variables configured
- ✅ WSOL feature tests
- ✅ Validation error tests

**Test Categories:**
- Order execution (native SOL, WSOL, custom slippage)
- Order retrieval and listing
- WebSocket health checks
- Validation tests (SOL↔WSOL rejection, invalid inputs)
- WSOL feature demonstrations

### Integration Tests

Location: `tests/integration/orderExecutionFlow.test.ts`

Tests complete end-to-end order execution:
- Order submission → Queue → Processing → DEX routing → Execution → WebSocket updates

## 🌐 Deployment

**🔗 Live Demo**: [https://order-execution-engine.onrender.com](https://order-execution-engine.onrender.com) *(Coming Soon)*

**Platform**: Render.com (Free Tier)

### Deployment Guide

#### Option 1: Deploy to Render (Recommended)

1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/amanydv72/Externa.git
   cd Externa/backend
   ```

2. **Create Render Account**
   - Visit [render.com](https://render.com)
   - Sign up with GitHub

3. **Deploy from Dashboard**
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml`
   - Click "Apply"

4. **Automatic Setup**
   - ✅ PostgreSQL database created
   - ✅ Redis instance created
   - ✅ Environment variables configured
   - ✅ Service deployed

5. **Access Your API**
   - Your URL: `https://your-service.onrender.com`
   - Health check: `GET /ws/health`

#### Option 2: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

#### Environment Variables

Required variables (automatically set with `render.yaml`):
- `NODE_ENV=production`
- `DATABASE_URL` (auto from Render PostgreSQL)
- `REDIS_HOST` (auto from Render Redis)
- `REDIS_PORT` (auto from Render Redis)
- `PORT=3000`
- `QUEUE_CONCURRENCY=10`
- `QUEUE_RATE_LIMIT=100`
- `MAX_RETRY_ATTEMPTS=3`

## 🎥 Video Demonstration

**📺 YouTube Demo**: [Watch Demo Video](https://youtube.com/placeholder) *(Recording in progress)*

**Video Highlights (1-2 minutes):**

### Part 1: System Architecture (15 sec)
- Architecture diagram walkthrough
- DEX routing explanation (Raydium vs Meteora)
- Key features overview

### Part 2: Concurrent Order Submission (30 sec)
- Submit 3-5 orders simultaneously using Postman
- Display order IDs returned immediately
- Show pending status

### Part 3: Real-time WebSocket Updates (30 sec)
- WebSocket connections streaming status
- Watch orders progress through 6 states:
  ```
  PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
  ```
- Multiple orders updating in real-time

### Part 4: DEX Routing Intelligence (15 sec)
- Console logs showing routing decisions
- Price comparison: Raydium vs Meteora
- Automatic best route selection with reasoning

### Part 5: Queue & Concurrency (15 sec)
- Queue statistics endpoint
- 10 concurrent order processing
- Retry logic demonstration (if order fails)

**Demo Features Showcased:**
- ✅ Concurrent order processing (10 simultaneous)
- ✅ WebSocket real-time status streaming
- ✅ Intelligent DEX routing with transparency
- ✅ Queue management (100 orders/min)
- ✅ Exponential backoff retry (max 3 attempts)
- ✅ WSOL handler (native SOL support)

## 📊 Postman Collection

Import the collection from `postman/collection.json`

## 📝 License

MIT

---

**Built with ❤️ for DEX trading optimization**
