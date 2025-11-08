import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../../services/order';
import { addOrderToQueue, getQueueStats } from '../../queue';
import { orderRepository } from '../../database';
import { OrderStatus, OrderType } from '../../models/enums';
import { environment } from '../../config/environment';
import logger from '../../utils/logger';
import {
  ExecuteOrderSchema,
  ExecuteOrderResponseSchema,
  GetOrderResponseSchema,
  ListOrdersQuerySchema,
  ListOrdersResponseSchema,
  ErrorResponseSchema,
} from '../schemas';

interface ExecuteOrderBody {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
  orderType?: OrderType;
}

interface GetOrderParams {
  orderId: string;
}

interface ListOrdersQuery {
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}

export async function registerOrderRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /api/orders/validate
   * Validate order data without executing
   */
  server.post<{ Body: ExecuteOrderBody }>(
    '/api/orders/validate',
    {
      schema: {
        body: ExecuteOrderSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              isValid: { type: 'boolean' },
            },
          },
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: ExecuteOrderBody }>, reply: FastifyReply) => {
      try {
        const { tokenIn, tokenOut, amountIn, slippage = 0.01, orderType = OrderType.MARKET } = request.body;

        // Validate order data
        const validation = await orderService.validateOrder({
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          orderType,
        });

        if (!validation.isValid) {
          return reply.code(400).send({
            success: false,
            error: 'Validation Error',
            message: validation.errors.join(', '),
            statusCode: 400,
          });
        }

        return reply.code(200).send({
          success: true,
          message: 'Order validation passed',
          isValid: true,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to validate order');
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * POST /api/orders/execute
   * Execute a new order
   */
  server.post<{ Body: ExecuteOrderBody }>(
    '/api/orders/execute',
    {
      schema: {
        body: ExecuteOrderSchema,
        response: {
          200: ExecuteOrderResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: ExecuteOrderBody }>, reply: FastifyReply) => {
      try {
        const { tokenIn, tokenOut, amountIn, slippage = 0.01, orderType = OrderType.MARKET } = request.body;

        // Validate order data
        const validation = await orderService.validateOrder({
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          orderType,
        });

        if (!validation.isValid) {
          return reply.code(400).send({
            success: false,
            error: 'Validation Error',
            message: validation.errors.join(', '),
            statusCode: 400,
          });
        }

        // Create order in database (this generates the order ID)
        const orderResult = await orderService.createOrder({
          type: orderType,
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
        });

        const orderId = orderResult.order.id;

        // Add to queue for processing
        await addOrderToQueue(orderId, {
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
        });

        // Construct WebSocket URL
        const protocol = environment.host === 'localhost' ? 'ws' : 'wss';
        const websocketUrl = `${protocol}://${environment.host}:${environment.port}/ws/orders/${orderId}`;

        logger.info({ orderId, websocketUrl }, 'Order submitted successfully');

        return reply.code(200).send({
          success: true,
          orderId,
          status: OrderStatus.PENDING,
          message: 'Order created and queued for execution',
          websocketUrl,
          data: {
            tokenIn: orderResult.order.tokenIn,
            tokenOut: orderResult.order.tokenOut,
            amountIn: orderResult.order.amountIn,
            slippage: orderResult.order.slippage,
            orderType: orderResult.order.type,
            createdAt: orderResult.order.createdAt.toISOString(),
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to execute order');
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/orders/:orderId
   * Get order by ID
   */
  server.get<{ Params: GetOrderParams }>(
    '/api/orders/:orderId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
          },
          required: ['orderId'],
        },
        response: {
          200: GetOrderResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: GetOrderParams }>, reply: FastifyReply) => {
      try {
        const { orderId } = request.params;

        // First try cache
        const cachedOrder = await orderService.getCachedOrder(orderId);
        if (cachedOrder) {
          return reply.code(200).send({
            success: true,
            order: cachedOrder,
          });
        }

        // If not in cache, get from database
        const order = await orderRepository.findById(orderId);

        if (!order) {
          return reply.code(404).send({
            success: false,
            error: 'Not Found',
            message: `Order ${orderId} not found`,
            statusCode: 404,
          });
        }

        return reply.code(200).send({
          success: true,
          order: {
            id: order.id,
            tokenIn: order.tokenIn,
            tokenOut: order.tokenOut,
            amountIn: order.amountIn,
            amountOut: order.amountOut || undefined,
            slippage: order.slippage,
            status: order.status,
            orderType: order.type,
            dexProvider: order.dexProvider || undefined,
            executedPrice: order.executedPrice || undefined,
            txHash: order.txHash || undefined,
            errorMessage: order.errorMessage || undefined,
            retryCount: order.retryCount,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get order');
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/orders
   * List orders with optional filtering
   */
  server.get<{ Querystring: ListOrdersQuery }>(
    '/api/orders',
    {
      schema: {
        querystring: ListOrdersQuerySchema,
        response: {
          200: ListOrdersResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListOrdersQuery }>, reply: FastifyReply) => {
      try {
        const { status, limit = 20, offset = 0 } = request.query;

        // Get orders from database
        const orders = await orderRepository.findAll({
          status,
          limit,
          offset,
        });

        // Get total count for pagination
        const total = await orderRepository.count(status);

        return reply.code(200).send({
          success: true,
          orders: orders.map((order) => ({
            id: order.id,
            tokenIn: order.tokenIn,
            tokenOut: order.tokenOut,
            amountIn: order.amountIn,
            amountOut: order.amountOut || undefined,
            status: order.status,
            orderType: order.type,
            dexProvider: order.dexProvider || undefined,
            executedPrice: order.executedPrice || undefined,
            txHash: order.txHash || undefined,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
          })),
          pagination: {
            limit,
            offset,
            total,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to list orders');
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/orders/stats
   * Get order statistics
   */
  server.get(
    '/api/orders/stats',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              stats: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  pending: { type: 'number' },
                  routing: { type: 'number' },
                  building: { type: 'number' },
                  submitted: { type: 'number' },
                  confirmed: { type: 'number' },
                  failed: { type: 'number' },
                },
              },
              queue: {
                type: 'object',
                properties: {
                  waiting: { type: 'number' },
                  active: { type: 'number' },
                  completed: { type: 'number' },
                  failed: { type: 'number' },
                },
              },
            },
          },
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Get order counts by status
        const [total, pending, routing, building, submitted, confirmed, failed] = await Promise.all([
          orderRepository.count(),
          orderRepository.count(OrderStatus.PENDING),
          orderRepository.count(OrderStatus.ROUTING),
          orderRepository.count(OrderStatus.BUILDING),
          orderRepository.count(OrderStatus.SUBMITTED),
          orderRepository.count(OrderStatus.CONFIRMED),
          orderRepository.count(OrderStatus.FAILED),
        ]);

        // Get queue stats
        const queueStats = await getQueueStats();

        return reply.code(200).send({
          success: true,
          stats: {
            total,
            pending,
            routing,
            building,
            submitted,
            confirmed,
            failed,
          },
          queue: queueStats,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get stats');
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    }
  );
}
