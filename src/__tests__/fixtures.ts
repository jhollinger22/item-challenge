import type { CreateItemRequest } from "../types/item.js";

export function buildItem(overrides: Partial<CreateItemRequest> = {}): CreateItemRequest {
  return {
    subject: "AP Biology",
    itemType: "multiple-choice",
    difficulty: 3,
    content: {
      question: "What is photosynthesis?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "Photosynthesis is the process...",
    },
    metadata: {
      author: "test-author",
      status: "draft",
      tags: ["biology"],
    },
    securityLevel: "standard",
    ...overrides,
  };
}
