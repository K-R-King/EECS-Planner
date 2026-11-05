import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/suite";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl("planner"), changeFrequency: "monthly", priority: 1 }];
}
