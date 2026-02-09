import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./lib/rate-limit";

// ---------------------------------------------------------------------------
// Rate limit tiers (requests per window)
// ---------------------------------------------------------------------------

/** Strict: wallet generation (slow faucet call, most expensive). */
const STRICT = { max: 5, windowMs: 60_000 } as const;

/** Moderate: all other POST routes (tx signing + ledger submission). */
const MODERATE = { max: 15, windowMs: 60_000 } as const;

/** Relaxed: GET routes (fast reads, still consume XRPL connection). */
const RELAXED = { max: 60, windowMs: 60_000 } as const;

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

function getTier(
  pathname: string,
  method: string,
): { max: number; windowMs: number } {
  if (pathname === "/api/accounts/generate" && method === "POST") {
    return STRICT;
  }
  if (method === "POST") {
    return MODERATE;
  }
  return RELAXED;
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

function getClientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to x-real-ip.
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  const ip = getClientIp(req);
  const tier = getTier(pathname, method);

  // Bucket key combines IP + tier so GET and POST limits are independent.
  const key = `${ip}:${method}:${pathname}`;
  const result = rateLimit(key, tier.max, tier.windowMs);

  if (!result.allowed) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return NextResponse.next();
}

// Only run middleware on API routes.
export const config = {
  matcher: "/api/:path*",
};
