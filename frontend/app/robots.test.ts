import { describe, expect, it } from "vitest";
import { createRobots } from "./robots";

describe("robots", () => {
  it("allows public pages and points to the configured sitemap", () => {
    expect(createRobots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "http://localhost:3000/sitemap.xml",
    });
  });
});
