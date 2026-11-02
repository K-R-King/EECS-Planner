// the companion EECS Links site (a separate project); locally it runs on port 3001
export const LINKS_URL =
  process.env.NEXT_PUBLIC_LINKS_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : undefined);
