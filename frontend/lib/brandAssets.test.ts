import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readPngSize = (path: string) => {
  const buffer = readFileSync(path);
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

describe("brand assets", () => {
  it("provides a self-contained SVG favicon", () => {
    const icon = readFileSync(join(process.cwd(), "app/icon.svg"), "utf8");
    expect(icon).toContain('viewBox="0 0 64 64"');
    expect(icon).not.toContain("KOKUSEI");
    expect(icon).not.toMatch(/<script|(?:href|src)=["']https?:\/\//);
  });

  it("provides a 180px square Apple Touch Icon", () => {
    expect(readPngSize(join(process.cwd(), "app/apple-icon.png"))).toEqual({ width: 180, height: 180 });
  });

  it("provides a 1200 by 630 PNG for social sharing", () => {
    expect(readPngSize(join(process.cwd(), "public/og-image.png"))).toEqual({ width: 1200, height: 630 });
  });
});
