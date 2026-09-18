import { z } from 'zod';

export const ITEM_TYPES = ['multiple-choice', 'free-response', 'essay'] as const;
export const ITEM_STATUSES = ['draft', 'review', 'approved', 'archived'] as const;
export const SECURITY_LEVELS = ['standard', 'secure', 'highly-secure'] as const;

const contentSchema = z.object({
  question: z.string().trim().min(1).max(10_000),
  options: z.array(z.string().trim().min(1)).min(2).max(10).optional(),
  correctAnswer: z.string().trim().min(1),
  explanation: z.string().trim().max(10_000),
});

const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(20);

export const createItemSchema = z
  .object({
    subject: z.string().trim().min(1).max(100),
    itemType: z.enum(ITEM_TYPES),
    difficulty: z.number().int().min(1).max(5),
    content: contentSchema,
    metadata: z.object({
      author: z.string().trim().min(1),
      status: z.enum(ITEM_STATUSES).default('draft'),
      tags: tagsSchema.default([]),
    }),
    securityLevel: z.enum(SECURITY_LEVELS).default('standard'),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.itemType !== 'multiple-choice') return;

    if (!item.content.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content', 'options'],
        message: 'options are required for multiple-choice items',
      });
    } else if (!item.content.options.includes(item.content.correctAnswer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content', 'correctAnswer'],
        message: 'correctAnswer must be one of the options',
      });
    }
  });

// server managed fields (id, created, version, author) are intentionaly not updateable
// TODO: cross-field check for multiple-choice (options/correctAnswer) needs the existing item,
// so partial updates can currently leave an MC item with a correctAnswer that isn't an option.
export const updateItemSchema = z
  .object({
    subject: z.string().trim().min(1).max(100).optional(),
    itemType: z.enum(ITEM_TYPES).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    content: contentSchema.partial().optional(),
    metadata: z
      .object({
        status: z.enum(ITEM_STATUSES).optional(),
        tags: tagsSchema.optional(),
      })
      .strict()
      .optional(),
    securityLevel: z.enum(SECURITY_LEVELS).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Request body must contain at least one field to update',
  });

export const listItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  subject: z.string().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
});
