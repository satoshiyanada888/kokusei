import { NextResponse } from "next/server";

/**
 * Blocks direct access to the image optimizer while the standalone runtime
 * includes sharp affected by GHSA-f88m-g3jw-g9cj. Do not remove this guard
 * until a fixed sharp version is verified in the production container.
 */
export function middleware() {
  return new NextResponse(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: "/_next/image",
};
