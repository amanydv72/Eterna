import Redis from 'ioredis';
import { environment } from './environment';

// Create Redis client
// Railway/Render provides REDIS_URL (full connection string)
// Local dev uses individual host/port
const redisUrl = environment.redis.url || environment.redis.privateUrl || environment.redis.publicUrl;

// Parse Redis URL and configure TLS properly for Railway
const getRedisConfig = () => {
  if (redisUrl) {
    console.log('🔍 Redis URL detected:', redisUrl.substring(0, 30) + '...');
    
    // Railway Redis uses redis:// (no TLS) for internal connections
    const config: any = {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      connectTimeout: 10000, // 10 second timeout
    };

    // Only enable TLS for rediss:// URLs (secure Redis)
    // Railway's internal Redis uses redis:// without TLS
    if (redisUrl.startsWith('rediss://')) {
      console.log('🔒 Configuring Redis with TLS');
      config.tls = {
        rejectUnauthorized: false,
      };
    } else {
      console.log('🔓 Using Redis without TLS (Railway internal network)');
    }

    return new Redis(redisUrl, config);
  }

  console.log('🏠 Using local Redis configuration');
  // Local development with host/port
  return new Redis({
    host: environment.redis.host,
    port: environment.redis.port,
    password: environment.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
};

export const redis = getRedisConfig();

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}

// Event handlers
redis.on('error', (error) => {
  console.error('❌ Redis error:', error);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});
