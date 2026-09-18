import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import {
  createItemHandler,
  listItemsHandler,
  updateItemHandler,
} from "../handlers/items.js";
import type { ExamItem, ListItemsResult } from "../types/item.js";
import { buildItem } from "./fixtures.js";

// TODO: more coverage - list filtering, invalid cursor, update validation edge cases

// Handlers share one in-memory store for the whole file, so the list test
// uses a unique subject to avoid seeing other tests' data.
async function createItem(overrides = {}) {
  const result = await createItemHandler(buildItem(overrides));
  expect(result.statusCode).toBe(201);
  return result.body as ExamItem;
}

describe("createItemHandler validation", () => {
  it("rejects an out of range difficulty", async () => {
    const result = await createItemHandler(buildItem({ difficulty: 6 }));
    expect(result.statusCode).toBe(400);
    expect(result.body).toHaveProperty("error", "Validation failed");
  });

  it("rejects a correctAnswer that isn't one of the options", async () => {
    const item = buildItem();
    item.content.correctAnswer = "E";

    const result = await createItemHandler(item);

    expect(result.statusCode).toBe(400);
    expect(JSON.stringify(result.body)).toContain("content.correctAnswer");
  });
});

describe("updateItemHandler", () => {
  it("merges partial content and bumps the version", async () => {
    const item = await createItem();

    const result = await updateItemHandler(item.id, {
      difficulty: 4,
      content: { explanation: "Better explanation" },
    });

    expect(result.statusCode).toBe(200);
    const updated = result.body as ExamItem;
    expect(updated.content.explanation).toBe("Better explanation");
    expect(updated.content.question).toBe(item.content.question);
    expect(updated.metadata.version).toBe(2);
  });

  it("returns 404 for an unknown item", async () => {
    const result = await updateItemHandler(randomUUID(), { difficulty: 2 });
    expect(result.statusCode).toBe(404);
  });

  it("returns 409 when the item is archived", async () => {
    const item = await createItem();
    await updateItemHandler(item.id, { metadata: { status: "archived" } });

    const result = await updateItemHandler(item.id, { difficulty: 1 });
    expect(result.statusCode).toBe(409);
  });
});

describe("listItemsHandler", () => {
  it("paginates with nextCursor", async () => {
    const subject = `Subject ${randomUUID()}`;
    for (let i = 0; i < 3; i++) await createItem({ subject });

    const page1 = (await listItemsHandler({ subject, limit: "2" })).body as ListItemsResult;
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = (await listItemsHandler({ subject, limit: "2", cursor: page1.nextCursor }))
      .body as ListItemsResult;
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeUndefined();
  });
});
