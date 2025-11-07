import { calculateBackoff } from '../../src/utils/helpers';

describe('Retry Logic', () => {
  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      // First attempt
      const backoff1 = calculateBackoff(0);
      expect(backoff1).toBeGreaterThanOrEqual(800); // 1000 - 20% jitter
      expect(backoff1).toBeLessThanOrEqual(1200); // 1000 + 20% jitter

      // Second attempt (2x)
      const backoff2 = calculateBackoff(1);
      expect(backoff2).toBeGreaterThanOrEqual(1600); // 2000 - 20% jitter
      expect(backoff2).toBeLessThanOrEqual(2400); // 2000 + 20% jitter

      // Third attempt (4x)
      const backoff3 = calculateBackoff(2);
      expect(backoff3).toBeGreaterThanOrEqual(3200); // 4000 - 20% jitter
      expect(backoff3).toBeLessThanOrEqual(4800); // 4000 + 20% jitter
    });

    it('should respect maximum delay of 30 seconds', () => {
      // Very high attempt number should cap at max delay
      const backoff = calculateBackoff(10);
      expect(backoff).toBeLessThanOrEqual(36000); // 30000 + 20% jitter
    });

    it('should add jitter to prevent thundering herd', () => {
      const backoffs = [];
      for (let i = 0; i < 10; i++) {
        backoffs.push(calculateBackoff(1));
      }

      // Not all backoffs should be exactly the same due to jitter
      const uniqueBackoffs = new Set(backoffs);
      expect(uniqueBackoffs.size).toBeGreaterThan(1);
    });

    it('should use custom base delay', () => {
      const customBaseDelay = 500;
      const backoff = calculateBackoff(0, customBaseDelay);
      
      expect(backoff).toBeGreaterThanOrEqual(400); // 500 - 20% jitter
      expect(backoff).toBeLessThanOrEqual(600); // 500 + 20% jitter
    });
  });
});
