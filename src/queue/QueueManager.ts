/**
 * Queue Manager
 * Centralized management for queue and worker lifecycle
 */
import { closeQueue } from './orderQueue';
import { closeWorker } from './orderProcessor';
import logger from '../utils/logger';

export class QueueManager {
  private static instance: QueueManager;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize queue and worker
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue manager...');
      
      // Queue is already created, just log status
      logger.info('Order queue initialized');
      
      // Worker is already created and listening
      logger.info('Order worker initialized and ready');

      this.isInitialized = true;
      logger.info('Queue manager initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize queue manager');
      throw error;
    }
  }

  /**
   * Shutdown queue and worker gracefully
   */
  async shutdown() {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down queue manager...');

      await closeWorker();
      await closeQueue();

      this.isInitialized = false;
      logger.info('Queue manager shut down successfully');
    } catch (error) {
      logger.error({ error }, 'Error during queue manager shutdown');
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

export const queueManager = QueueManager.getInstance();
