import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /health", () => {
  it("returns a lightweight process health response", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
