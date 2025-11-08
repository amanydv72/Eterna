import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { environment } from '../config/environment';
import { testDatabaseConnection, closeDatabaseConnection } from '../config/database';
import { testRedisConnection, closeRedisConnection } from '../config/redis';
import { queueManager } from '../queue';
import { registerWebSocketRoutes } from '../websocket';
import { registerApiRoutes } from '../api';
import { runIntegrationTest } from './orderExecutionFlow.test';
import logger from '../utils/logger';

/**
 * Integration Test Runner
 * Starts server, runs integration tests, and shuts down gracefully
 */
async function runTests() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  try {
    logger.info('Starting integration test runner...');

    // Register plugins
    await fastify.register(cors, { origin: true, credentials: true });
    await fastify.register(websocket, { options: { maxPayload: 1048576 } });

    // Register routes
    await registerWebSocketRoutes(fastify);
    await registerApiRoutes(fastify);

    // Test connections
    logger.info('Testing database and Redis connections...');
    const dbHealthy = await testDatabaseConnection();
    const redisHealthy = await testRedisConnection();

    if (!dbHealthy || !redisHealthy) {
      throw new Error('Required services are not available');
    }

    logger.info('✅ Database and Redis connections successful');

    // Initialize queue manager
    logger.info('Initializing queue manager...');
    await queueManager.initialize();
    logger.info('✅ Queue manager initialized');

    // Start server
    await fastify.listen({
      port: environment.port,
      host: environment.host,
    });

    logger.info(`✅ Server started at http://${environment.host}:${environment.port}`);

    // Wait a bit for everything to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run integration tests
    await runIntegrationTest(fastify);

    // Success
    logger.info('✅ All integration tests completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error({ error }, '❌ Integration tests failed');
    process.exit(1);
  } finally {
    // Cleanup
    try {
      logger.info('Cleaning up...');
      await queueManager.shutdown();
      await fastify.close();
      await closeDatabaseConnection();
      await closeRedisConnection();
      logger.info('✅ Cleanup completed');
    } catch (cleanupError) {
      logger.error({ error: cleanupError }, 'Error during cleanup');
    }
  }
}

// Run tests
runTests();
