import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isOnboardingRoute = createRouteMatcher(["/onboarding"]);
const isPublicRoute = createRouteMatcher(["/public", "/sign-in", "/sign-up"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  // Allow access to sign-in, sign-up, and onboarding pages
  if (userId && isOnboardingRoute(req)) return NextResponse.next();
  if (!userId && isPublicRoute(req)) return NextResponse.next();

  // Prevent infinite sign-in loop
  if (req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up")) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Redirect users to onboarding if they haven't completed it
  if (userId && !sessionClaims?.metadata?.onboardingComplete) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|svg|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
