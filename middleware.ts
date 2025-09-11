import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  const pathname = req.nextUrl.pathname;

  const isPublicApiCall = pathname.startsWith("/api/trpc/user.");

  // If not signed in → redirect to sign-in
  if (!userId && !isPublicRoute(req) && !isPublicApiCall) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Otherwise, just continue
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
