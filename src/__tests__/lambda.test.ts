import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createItem, getItem } from "../lambda.js";
import { buildItem } from "./fixtures.js";

// Only the fields the adapter actually reads
function event(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: "GET",
    path: "/api/items",
    body: null,
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { requestId: "test-request" },
    ...overrides,
  } as APIGatewayProxyEvent;
}

describe("lambda adapter", () => {
  it("creates and then fetches an item via path parameters", async () => {
    const created = await createItem(
      event({ httpMethod: "POST", body: JSON.stringify(buildItem()) }),
    );
    expect(created.statusCode).toBe(201);
    const { id } = JSON.parse(created.body);

    const res = await getItem(event({ pathParameters: { id } }));

    expect(res.statusCode).toBe(200);
    expect(res.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(res.body).id).toBe(id);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await createItem(event({ httpMethod: "POST", body: "{not json" }));
    expect(res.statusCode).toBe(400);
  });
});
