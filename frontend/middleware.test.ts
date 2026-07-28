import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

describe("image optimizer middleware", () => {
  it("returns a fixed 404 response without processing request input", () => {
    const response = middleware();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.body).toBeNull();
  });
});
