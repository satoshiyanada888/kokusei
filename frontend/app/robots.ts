import type { MetadataRoute } from "next";
import { buildAbsoluteUrl } from "@/lib/siteConfig";

export const createRobots = (): MetadataRoute.Robots => ({
  rules: { userAgent: "*", allow: "/" },
  sitemap: buildAbsoluteUrl("/sitemap.xml"),
});

export default function robots(): MetadataRoute.Robots {
  return createRobots();
}
