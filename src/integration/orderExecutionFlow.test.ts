import { FastifyInstance } from 'fastify';
import { OrderStatus } from '../models/enums';
import { orderRepository } from '../database';
import { wsManager } from '../websocket';
import logger from '../utils/logger';

/**
 * Integration test for complete order execution flow
 * Tests end-to-end: API → Queue → Worker → DEX → Database → WebSocket
 */
export async function testOrderExecutionFlow(server: FastifyInstance): Promise<void> {
  logger.info('Starting order execution flow integration test...');

  try {
    // Step 1: Submit order via API
    const orderPayload = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amountIn: 10,
      slippage: 0.01,
    };

    logger.info({ payload: orderPayload }, 'Step 1: Submitting order via API');
    
    const response = await server.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: orderPayload,
    });

    const result = JSON.parse(response.body);
    
    if (response.statusCode !== 200 || !result.success) {
      throw new Error(`Order submission failed: ${response.body}`);
    }

    const orderId = result.orderId;
    logger.info({ orderId, websocketUrl: result.websocketUrl }, 'Order submitted successfully');

    // Step 2: Verify order created in database
    logger.info({ orderId }, 'Step 2: Verifying order in database');
    
    let order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Order not found in database');
    }
    
    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Expected status PENDING, got ${order.status}`);
    }
    
    logger.info({ orderId, status: order.status }, 'Order found with correct initial status');

    // Step 3: Wait for worker to process (with timeout)
    logger.info({ orderId }, 'Step 3: Waiting for worker to process order...');
    
    const maxWaitTime = 15000; // 15 seconds
    const checkInterval = 500; // 500ms
    let elapsed = 0;
    let finalStatus: OrderStatus | null = null;

    while (elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order disappeared from database');
      }

      logger.debug({ 
        orderId, 
        status: order.status, 
        elapsed: `${elapsed}ms` 
      }, 'Checking order status');

      // Check if order reached a final state
      if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.FAILED) {
        finalStatus = order.status;
        break;
      }
    }

    if (!finalStatus) {
      throw new Error(`Order did not complete within ${maxWaitTime}ms. Last status: ${order.status}`);
    }

    // Step 4: Verify execution results
    logger.info({ orderId, finalStatus }, 'Step 4: Verifying execution results');

    if (finalStatus === OrderStatus.CONFIRMED) {
      if (!order.executedPrice) {
        throw new Error('Confirmed order missing executedPrice');
      }
      if (!order.amountOut) {
        throw new Error('Confirmed order missing amountOut');
      }
      if (!order.txHash) {
        throw new Error('Confirmed order missing txHash');
      }
      if (!order.dexProvider) {
        throw new Error('Confirmed order missing dexProvider');
      }

      logger.info({
        orderId,
        status: finalStatus,
        dexProvider: order.dexProvider,
        executedPrice: order.executedPrice,
        amountOut: order.amountOut,
        txHash: order.txHash,
        retryCount: order.retryCount,
      }, '✅ Order execution flow completed successfully');

    } else {
      logger.error({
        orderId,
        status: finalStatus,
        errorMessage: order.errorMessage,
        retryCount: order.retryCount,
      }, '❌ Order execution failed');
      
      throw new Error(`Order failed: ${order.errorMessage}`);
    }

    // Step 5: Verify WebSocket connections tracking
    logger.info({ orderId }, 'Step 5: Checking WebSocket manager stats');
    
    const wsStats = wsManager.getStats();
    logger.info({ wsStats }, 'WebSocket statistics');

    logger.info('🎉 Complete order execution flow test PASSED');

  } catch (error) {
    logger.error({ error }, '❌ Order execution flow test FAILED');
    throw error;
  }
}

/**
 * Run integration test scenario
 */
export async function runIntegrationTest(server: FastifyInstance): Promise<void> {
  logger.info('='.repeat(80));
  logger.info('RUNNING INTEGRATION TEST: Order Execution Flow');
  logger.info('='.repeat(80));

  try {
    await testOrderExecutionFlow(server);
    logger.info('='.repeat(80));
    logger.info('✅ ALL INTEGRATION TESTS PASSED');
    logger.info('='.repeat(80));
  } catch (error) {
    logger.error('='.repeat(80));
    logger.error('❌ INTEGRATION TESTS FAILED');
    logger.error('='.repeat(80));
    throw error;
  }
}
