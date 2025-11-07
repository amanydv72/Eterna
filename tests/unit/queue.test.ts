import { addOrderToQueue, getQueueStats, closeQueue } from '../../src/queue/orderQueue';
import { closeRedisConnection } from '../../src/config/redis';
import { OrderType } from '../../src/models';

describe('Order Queue', () => {
  afterAll(async () => {
    await closeQueue();
    await closeRedisConnection();
  });

  describe('addOrderToQueue', () => {
    it('should add order to queue successfully', async () => {
      const orderId = `test-order-${Date.now()}`;
      const orderData = {
        type: OrderType.MARKET,
        tokenIn: 'So11111111111111111111111111111111111111112',
        tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amountIn: 10,
        slippage: 0.01,
      };

      const job = await addOrderToQueue(orderId, orderData);

      expect(job).toBeDefined();
      expect(job.id).toBe(orderId);
      expect(job.data.orderId).toBe(orderId);
      expect(job.data.orderData).toEqual(orderData);
    });

    it('should use orderId as jobId for idempotency', async () => {
      const orderId = `test-order-idempotent-${Date.now()}`;
      const orderData = {
        type: OrderType.MARKET,
        tokenIn: 'So11111111111111111111111111111111111111112',
        tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amountIn: 5,
        slippage: 0.01,
      };

      const job1 = await addOrderToQueue(orderId, orderData);
      
      // Adding same order again should return same job
      const job2 = await addOrderToQueue(orderId, orderData);

      expect(job1.id).toBe(job2.id);
      expect(job1.id).toBe(orderId);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await getQueueStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
      expect(stats).toHaveProperty('total');
      
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.total).toBe('number');
    });

    it('should have total equal to sum of all states', async () => {
      const stats = await getQueueStats();
      
      const sum = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;
      expect(stats.total).toBe(sum);
    });
  });
});
