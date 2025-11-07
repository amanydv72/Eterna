import { addOrderToQueue, getQueueStats, getJob } from '../../queue/orderQueue';
import { OrderStatus } from '../../models';
import { orderRepository } from '../../database';
import { cacheService } from '../cache';
import logger from '../../utils/logger';

/**
 * Queue Service
 * High-level service for queue operations
 */
export class QueueService {
  /**
   * Submit order for processing
   */
  async submitOrder(orderId: string, orderData: any) {
    try {
      // Cache the order
      await cacheService.cacheOrder(orderId, {
        id: orderId,
        status: OrderStatus.PENDING,
        ...orderData,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add to queue
      const job = await addOrderToQueue(orderId, orderData);

      logger.info({ orderId, jobId: job.id }, 'Order submitted to queue');

      return {
        success: true,
        orderId,
        jobId: job.id,
        status: OrderStatus.PENDING,
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to submit order');
      throw error;
    }
  }

  /**
   * Get order status from queue
   */
  async getOrderStatus(orderId: string) {
    try {
      // Try to get from cache first
      const cachedOrder = await cacheService.getCachedOrder(orderId);
      if (cachedOrder) {
        return {
          success: true,
          order: cachedOrder,
          source: 'cache',
        };
      }

      // Fall back to database
      const orderRecord = await orderRepository.findById(orderId);
      if (!orderRecord) {
        return {
          success: false,
          error: 'Order not found',
        };
      }

      return {
        success: true,
        order: orderRecord,
        source: 'database',
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to get order status');
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    try {
      const job = await getJob(jobId);
      
      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        success: true,
        job: {
          id: job.id,
          state,
          progress,
          attemptsMade: job.attemptsMade,
          data: job.data,
          timestamp: job.timestamp,
        },
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job status');
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    try {
      const stats = await getQueueStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get queue stats');
      throw error;
    }
  }

  /**
   * Get order status updates history
   */
  async getOrderUpdates(orderId: string) {
    try {
      const updates = await cacheService.getStatusUpdates(orderId);
      return {
        success: true,
        updates,
      };
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to get order updates');
      throw error;
    }
  }
}

export const queueService = new QueueService();
