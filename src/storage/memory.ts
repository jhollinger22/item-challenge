/**
 * In-Memory Storage Implementation
 *
 * This is a simple in-memory storage for local development and testing.
 * Data is lost when the server restarts.
 */

import { randomUUID } from 'crypto';
import {
  ExamItem,
  CreateItemRequest,
  UpdateItemRequest,
  ListItemsQuery,
  ListItemsResult,
} from '../types/item.js';
import { InvalidCursorError } from './errors.js';
import { ItemStorage } from './interface.js';

export class MemoryStorage implements ItemStorage {
  private items: Map<string, ExamItem> = new Map();
  private versions: Map<string, ExamItem[]> = new Map();

  async createItem(data: CreateItemRequest): Promise<ExamItem> {
    const now = Date.now();
    const item: ExamItem = {
      id: randomUUID(),
      ...data,
      metadata: {
        ...data.metadata,
        created: now,
        lastModified: now,
        version: 1,
      },
    };

    this.items.set(item.id, item);
    this.versions.set(item.id, [{ ...item }]);

    return item;
  }

  async getItem(id: string): Promise<ExamItem | null> {
    return this.items.get(id) || null;
  }

  async updateItem(id: string, data: UpdateItemRequest): Promise<ExamItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const updated: ExamItem = {
      ...item,
      ...data,
      content: data.content ? { ...item.content, ...data.content } : item.content,
      metadata: {
        ...item.metadata,
        ...(data.metadata || {}),
        lastModified: Date.now(),
        version: item.metadata.version + 1,
      },
    };

    this.items.set(id, updated);

    // Save version history
    const history = this.versions.get(id) || [];
    history.push({ ...updated });
    this.versions.set(id, history);

    return updated;
  }

  async listItems(query: ListItemsQuery): Promise<ListItemsResult> {
    let items = Array.from(this.items.values());

    // Filter by subject
    if (query.subject) {
      items = items.filter(item => item.subject === query.subject);
    }

    // Filter by status
    if (query.status) {
      items = items.filter(item => item.metadata.status === query.status);
    }

    const total = items.length;

    // Pagination - cursor is just a base64 encoded offset here so the API
    // contract matches the DynamoDB implementation (opaque nextCursor)
    const offset = query.cursor ? decodeOffset(query.cursor) : query.offset || 0;
    const limit = query.limit || 10;
    items = items.slice(offset, offset + limit);

    const nextOffset = offset + limit;
    const nextCursor = nextOffset < total ? Buffer.from(String(nextOffset)).toString('base64url') : undefined;

    return { items, total, nextCursor };
  }

  async createVersion(id: string): Promise<ExamItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    // Create a new version (copy of current state)
    const newVersion: ExamItem = {
      ...item,
      metadata: {
        ...item.metadata,
        version: item.metadata.version + 1,
        lastModified: Date.now(),
      },
    };

    this.items.set(id, newVersion);

    const history = this.versions.get(id) || [];
    history.push({ ...newVersion });
    this.versions.set(id, history);

    return newVersion;
  }

  async getAuditTrail(id: string): Promise<ExamItem[]> {
    return this.versions.get(id) || [];
  }
}

function decodeOffset(cursor: string): number {
  const offset = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(offset) || offset < 0) throw new InvalidCursorError();
  return offset;
}
