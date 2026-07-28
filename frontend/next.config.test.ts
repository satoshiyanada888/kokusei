import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("Next.js production configuration", () => {
  it("keeps built-in image optimization disabled", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });
});
