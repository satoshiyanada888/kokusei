import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getIndicator, getIndicators, isNotFoundError } from "./api";

describe("API errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns an empty list as a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(getIndicators()).resolves.toEqual([]);
  });

  it("identifies only an API 404 as not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    await expect(getIndicator("missing")).rejects.toSatisfy((error: unknown) => isNotFoundError(error));
    expect(isNotFoundError(new ApiError(500))).toBe(false);
    expect(isNotFoundError(new TypeError("network failed"))).toBe(false);
  });

  it("does not include an internal URL or response body in an API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("database details", { status: 500 })));

    await expect(getIndicators()).rejects.toMatchObject({ message: "API request failed", status: 500 });
  });
});
