import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // basePath '/dashboard' is applied at deploy time (see docs/plan/dashboard_redesign/deployment.md)
  // via NEXT_PUBLIC_BASE_PATH so the public URL stays …run.app/dashboard/. Left unset for local dev.
  ...(process.env.NEXT_PUBLIC_BASE_PATH ? { basePath: process.env.NEXT_PUBLIC_BASE_PATH } : {}),
};

export default nextConfig;
