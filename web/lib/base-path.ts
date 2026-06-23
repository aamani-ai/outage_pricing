/**
 * basePath-aware internal URL builder. NEXT_PUBLIC_BASE_PATH is "" for local dev and
 * "/dashboard" in production (set at build time) so the public URL stays …run.app/dashboard/.
 * Next prefixes Link/asset paths automatically, but raw fetch() calls to /api/* are NOT —
 * so every internal API fetch must go through this.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const api = (path: string) => `${BASE_PATH}${path}`;
