/**
 * Storage Interface
 *
 * This interface defines the contract for item storage.
 * Implement this interface for different storage backends (in-memory, DynamoDB, etc.)
 */

import {
  ExamItem,
  CreateItemRequest,
  UpdateItemRequest,
  ListItemsQuery,
  ListItemsResult,
} from '../types/item.js';

export interface ItemStorage {
  createItem(data: CreateItemRequest): Promise<ExamItem>;
  getItem(id: string): Promise<ExamItem | null>;
  updateItem(id: string, data: UpdateItemRequest): Promise<ExamItem | null>;
  listItems(query: ListItemsQuery): Promise<ListItemsResult>;
  createVersion(id: string): Promise<ExamItem | null>;
  getAuditTrail(id: string): Promise<ExamItem[]>;
}
