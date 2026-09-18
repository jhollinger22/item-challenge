/**
 * Exam Item Types
 */

export interface ExamItem {
  id: string;
  subject: string; // e.g., "AP Biology", "AP Calculus"
  itemType: string; // "multiple-choice", "free-response", "essay"
  difficulty: number; // 1-5
  content: {
    question: string;
    options?: string[]; // For multiple choice
    correctAnswer: string;
    explanation: string;
  };
  metadata: {
    author: string;
    created: number; // timestamp
    lastModified: number; // timestamp
    version: number;
    status: string; // "draft", "review", "approved", "archived"
    tags: string[];
  };
  securityLevel: string; // "standard", "secure", "highly-secure"
}

export interface CreateItemRequest {
  subject: string;
  itemType: string;
  difficulty: number;
  content: {
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  };
  metadata: {
    author: string;
    status: string;
    tags: string[];
  };
  securityLevel: string;
}

export interface UpdateItemRequest {
  subject?: string;
  itemType?: string;
  difficulty?: number;
  content?: Partial<ExamItem["content"]>;
  metadata?: Partial<ExamItem["metadata"]>;
  securityLevel?: string;
}

export interface ListItemsQuery {
  limit?: number;
  offset?: number; // only used by MemoryStorage, prefer cursor
  cursor?: string; // opaque pagination token returned as nextCursor
  subject?: string;
  status?: string;
}

export interface ListItemsResult {
  items: ExamItem[];
  total?: number; // not available from DynamoDB without a full scan
  nextCursor?: string;
}
