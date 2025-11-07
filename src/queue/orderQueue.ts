import { Queue, QueueOptions } from 'bullmq';
import { redis } from '../config/redis';
import { environment } from '../config/environment';
import logger from '../utils/logger';

/**
 * Order Queue Configuration
 */
const queueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: environment.queue.maxRetryAttempts,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 3600, // Keep for 1 hour
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
      age: 7200, // Keep for 2 hours
    },
  },
};

/**
 * Order execution queue
 * Manages order processing with concurrency control
 */
export const orderQueue = new Queue('order-execution', queueOptions);

// Queue event listeners for monitoring
orderQueue.on('error', (error) => {
  logger.error({ error }, 'Queue error occurred');
});

orderQueue.on('waiting', (job) => {
  logger.debug({ jobId: job.id }, 'Job is waiting');
});

// Remove incompatible event listeners for Queue
// Use QueueEvents instead for these events

orderQueue.on('error', (error) => {
  logger.error({ error }, 'Queue error occurred');
});

/**
 * Add order to queue
 */
export async function addOrderToQueue(orderId: string, orderData: any) {
  try {
    const job = await orderQueue.add(
      'process-order',
      {
        orderId,
        orderData,
        timestamp: new Date().toISOString(),
      },
      {
        jobId: orderId, // Use orderId as jobId for idempotency
        priority: orderData.priority || 1,
      }
    );

    logger.info({ orderId, jobId: job.id }, 'Order added to queue');
    return job;
  } catch (error) {
    logger.error({ error, orderId }, 'Failed to add order to queue');
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
    orderQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string) {
  return await orderQueue.getJob(jobId);
}

/**
 * Clean old jobs
 */
export async function cleanQueue() {
  await orderQueue.clean(3600000, 100, 'completed'); // Clean completed jobs older than 1 hour
  await orderQueue.clean(7200000, 50, 'failed'); // Clean failed jobs older than 2 hours
  logger.info('Queue cleaned');
}

/**
 * Pause queue
 */
export async function pauseQueue() {
  await orderQueue.pause();
  logger.info('Queue paused');
}

/**
 * Resume queue
 */
export async function resumeQueue() {
  await orderQueue.resume();
  logger.info('Queue resumed');
}

/**
 * Close queue connection
 */
export async function closeQueue() {
  await orderQueue.close();
  logger.info('Queue closed');
}
