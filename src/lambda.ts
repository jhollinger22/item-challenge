import type { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda';
import { HandlerResult, error } from './lib/http.js';
import { logger } from './lib/logger.js';
import {
  createItemHandler,
  createVersionHandler,
  getAuditTrailHandler,
  getItemHandler,
  listItemsHandler,
  updateItemHandler,
} from './handlers/items.js';

type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

class BadRequestError extends Error {}


function toResponse(result: HandlerResult): APIGatewayProxyResult {
  return {
    statusCode: result.statusCode,
    headers: {
      'Content-Type': 'application/json',
      // TODO: lock down to the real frontend origin per environment
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result.body),
  };
}

function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

function pathId(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.id;
  if (!id) throw new BadRequestError('Missing item id');
  return id;
}

function route(fn: (event: APIGatewayProxyEvent) => Promise<HandlerResult>): Handler {
  return async (event) => {
    const start = Date.now();
    let result: HandlerResult;

    try {
      result = await fn(event);
    } catch (err) {
      // Handlers catch their own errors, so this should only be bad input from the adapter
      if (err instanceof BadRequestError) {
        result = error(400, err.message);
      } else {
        logger.error('Unexpected adapter error', { error: String(err) });
        result = error(500, 'Internal server error');
      }
    }

    logger.info('request', {
      requestId: event.requestContext?.requestId,
      method: event.httpMethod,
      path: event.path,
      statusCode: result.statusCode,
      durationMs: Date.now() - start,
    });

    return toResponse(result);
  };
}

export const createItem = route((event) => createItemHandler(parseBody(event)));

export const getItem = route((event) => getItemHandler(pathId(event)));

export const updateItem = route((event) => updateItemHandler(pathId(event), parseBody(event)));

export const listItems = route((event) =>
  listItemsHandler((event.queryStringParameters ?? {}) as Record<string, string | undefined>),
);

export const createVersion = route((event) => createVersionHandler(pathId(event)));

export const getAuditTrail = route((event) => getAuditTrailHandler(pathId(event)));
