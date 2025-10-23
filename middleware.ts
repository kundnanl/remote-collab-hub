import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, redirectToSignIn } = await auth();

  const pathname = req.nextUrl.pathname;
  const isPublicApiCall = pathname.startsWith("/api/trpc/user.");

  if (!userId && !isPublicRoute(req) && !isPublicApiCall) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  const res = NextResponse.next();
  if (orgId) res.headers.set("x-clerk-org-id", orgId);

  return res;
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
