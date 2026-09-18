/**
 * Local Development Server
 *
 * A simple HTTP server for testing your handlers locally.
 * Run with: pnpm dev
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  getItemHandler,
  createItemHandler,
  updateItemHandler,
  listItemsHandler,
  createVersionHandler,
  getAuditTrailHandler,
} from './handlers/items.js';

const PORT = process.env.PORT || 3000;

// Mirrors the API Gateway resource tree defined in infrastructure/lib/item-api-stack.ts
const ITEM_ROUTE = /^\/api\/items\/([^/]+)$/;
const VERSIONS_ROUTE = /^\/api\/items\/([^/]+)\/versions$/;
const AUDIT_ROUTE = /^\/api\/items\/([^/]+)\/audit$/;

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const { method } = req;
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/$/, '');

  // Parse request body
  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(resolve => req.on('end', resolve));

  console.log(`${method} ${req.url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    let parsedBody: unknown = null;
    try {
      parsedBody = body ? JSON.parse(body) : null;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body must be valid JSON' }));
      return;
    }

    // TODO: this is getting long, might be worth a tiny router
    let result;
    let match: RegExpMatchArray | null;

    if (method === 'POST' && path === '/api/items') {
      result = await createItemHandler(parsedBody);
    } else if (method === 'GET' && path === '/api/items') {
      result = await listItemsHandler(Object.fromEntries(url.searchParams));
    } else if (method === 'POST' && (match = path.match(VERSIONS_ROUTE))) {
      result = await createVersionHandler(match[1]);
    } else if (method === 'GET' && (match = path.match(AUDIT_ROUTE))) {
      result = await getAuditTrailHandler(match[1]);
    } else if (method === 'GET' && (match = path.match(ITEM_ROUTE))) {
      result = await getItemHandler(match[1]);
    } else if (method === 'PUT' && (match = path.match(ITEM_ROUTE))) {
      result = await updateItemHandler(match[1], parsedBody);
    } else {
      result = {
        statusCode: 404,
        body: { error: 'Route not found' },
      };
    }

    res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   http://localhost:${PORT}/api/items`);
  console.log(`  GET    http://localhost:${PORT}/api/items?subject=&status=&limit=&cursor=`);
  console.log(`  GET    http://localhost:${PORT}/api/items/:id`);
  console.log(`  PUT    http://localhost:${PORT}/api/items/:id`);
  console.log(`  POST   http://localhost:${PORT}/api/items/:id/versions`);
  console.log(`  GET    http://localhost:${PORT}/api/items/:id/audit`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
