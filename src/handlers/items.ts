import { createStorage } from '../storage/index.js';
import { error, handleError, notFound, ok } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { createItemSchema, listItemsQuerySchema, updateItemSchema } from '../validation/schemas.js';

const storage = createStorage();

export async function createItemHandler(data: unknown) {
  try {
    const input = createItemSchema.parse(data);
    const item = await storage.createItem(input);

    logger.info('Item created', { itemId: item.id, subject: item.subject });
    return ok(item, 201);
  } catch (err) {
    return handleError(err, { op: 'createItem' });
  }
}

export async function getItemHandler(id: string) {
  try {
    const item = await storage.getItem(id);
    if (!item) return notFound();

    return ok(item);
  } catch (err) {
    return handleError(err, { op: 'getItem', itemId: id });
  }
}

export async function updateItemHandler(id: string, data: unknown) {
  try {
    const changes = updateItemSchema.parse(data);

    const existing = await storage.getItem(id);
    if (!existing) return notFound();
    if (existing.metadata.status === 'archived') {
      return error(409, 'Archived items cannot be modified');
    }

    // console.log('updating', id, JSON.stringify(changes));
    const updated = await storage.updateItem(id, changes);
    if (!updated) return notFound(); // deleted between read + write (not possible yet, no DELETE)

    logger.info('Item updated', { itemId: id, version: updated.metadata.version });
    return ok(updated);
  } catch (err) {
    return handleError(err, { op: 'updateItem', itemId: id });
  }
}

export async function listItemsHandler(queryParams: Record<string, string | undefined> = {}) {
  try {
    const query = listItemsQuerySchema.parse(queryParams);
    const result = await storage.listItems(query);

    return ok(result);
  } catch (err) {
    return handleError(err, { op: 'listItems' });
  }
}

// not done yet, return 501 for now

/**
 * TODO: snapshot current state as version + 1. The storage layer already writes a
 * VERSION# record on every update, so this is mostly a matter of deciding whether it
 * takes a body (changes + change note) or just copies the current item.
 */
export async function createVersionHandler(id: string) {
  return error(501, 'Not implemented', { itemId: id });
}

/**
 * TODO: Query PK = ITEM#<id>, begins_with(SK, 'VERSION#'). Should also include who made
 * each change once we have auth context.
 */
export async function getAuditTrailHandler(id: string) {
  return error(501, 'Not implemented', { itemId: id });
}
