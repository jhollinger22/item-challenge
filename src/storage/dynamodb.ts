/**
 * DynamoDB Storage Implementation (Optional)
 *
 * This implementation uses AWS DynamoDB for persistent storage.
 *
 * To use this:
 * 1. Set environment variable: USE_DYNAMODB=true
 * 2. Configure AWS credentials (or use DynamoDB Local)
 * 3. Set DYNAMODB_TABLE_NAME (or use default "ExamItems")
 *
 * For DynamoDB Local:
 * - Download from: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
 * - Run: java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
 * - Set DYNAMODB_ENDPOINT=http://localhost:8000
 *
 * Single table design (see ARCHITECTURE.md):
 *   PK = ITEM#<id>   SK = LATEST            -> current state of the item
 *   PK = ITEM#<id>   SK = VERSION#<000001>  -> snapshot per version
 *   GSI1 (by subject): GSI1PK = SUBJECT#<subject>
 *   GSI2 (by status):  GSI2PK = STATUS#<status>
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import {
  ExamItem,
  CreateItemRequest,
  UpdateItemRequest,
  ListItemsQuery,
  ListItemsResult,
} from '../types/item.js';
import { ItemStorage } from './interface.js';

export class DynamoDBStorage implements ItemStorage {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'ExamItems';
  }

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

    await this.saveItem(item);

    return item;
  }

  async getItem(id: string): Promise<ExamItem | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `ITEM#${id}`, SK: 'LATEST' },
    }));

    if (!result.Item) return null;

    // TODO: strip the key attributes (PK/SK/GSI*) before returning
    return result.Item as ExamItem;
  }

  async updateItem(id: string, data: UpdateItemRequest): Promise<ExamItem | null> {
    const existing = await this.getItem(id);
    if (!existing) return null;

    // TODO: same merge logic as memory.ts, should pull this out
    const updated: ExamItem = {
      ...existing,
      ...data,
      content: data.content ? { ...existing.content, ...data.content } : existing.content,
      metadata: {
        ...existing.metadata,
        ...(data.metadata || {}),
        lastModified: Date.now(),
        version: existing.metadata.version + 1,
      },
    };

    // TODO: optimistic locking - condition on the previous version so concurrent
    // updates don't overwrite each other (should return a 409)
    await this.saveItem(updated);

    return updated;
  }

  async listItems(query: ListItemsQuery): Promise<ListItemsResult> {
    const limit = query.limit || 10;
    // TODO: validate the cursor, garbage in here currently ends up as a 500
    const startKey = query.cursor
      ? JSON.parse(Buffer.from(query.cursor, 'base64').toString())
      : undefined;

    let result;
    if (query.subject) {
      // TODO: support subject + status together (begins_with on GSI1SK)
      result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': `SUBJECT#${query.subject}` },
        Limit: limit,
        ExclusiveStartKey: startKey,
      }));
    } else if (query.status) {
      result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `STATUS#${query.status}` },
        Limit: limit,
        ExclusiveStartKey: startKey,
      }));
    } else {
      // TODO: scan is fine for now but shouldn't be the main path
      result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { ':sk': 'LATEST' },
        Limit: limit,
        ExclusiveStartKey: startKey,
      }));
    }

    return {
      items: (result.Items || []) as ExamItem[],
      nextCursor: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };
  }

  async createVersion(id: string): Promise<ExamItem | null> {
    // TODO: Implement versioning strategy
    throw new Error('Not implemented - define your versioning strategy');
  }

  async getAuditTrail(id: string): Promise<ExamItem[]> {
    // TODO: Implement audit trail retrieval
    // Query PK = ITEM#<id> AND begins_with(SK, 'VERSION#')
    throw new Error('Not implemented - define your audit trail strategy');
  }

  // Writes the current record + a version snapshot
  // TODO: these should be one TransactWrite so they can't get out of sync
  private async saveItem(item: ExamItem) {
    const pk = `ITEM#${item.id}`;

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...item,
        PK: pk,
        SK: 'LATEST',
        GSI1PK: `SUBJECT#${item.subject}`,
        GSI1SK: `STATUS#${item.metadata.status}#${item.metadata.lastModified}`,
        GSI2PK: `STATUS#${item.metadata.status}`,
        GSI2SK: String(item.metadata.lastModified),
      },
    }));

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...item,
        PK: pk,
        SK: `VERSION#${String(item.metadata.version).padStart(6, '0')}`,
      },
    }));
  }
}
