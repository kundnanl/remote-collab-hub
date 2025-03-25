import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isOnboardingRoute = createRouteMatcher(['/onboarding'])
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in',
  '/sign-up',
  '/onboarding',
  '/api/webhooks/clerk',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth()

  const pathname = req.nextUrl.pathname

  const isPublicApiCall =
    pathname.startsWith('/api/trpc/user.completeOnboarding')

  if (!userId && !isPublicRoute(req) && !isPublicApiCall) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  if (
    userId &&
    !sessionClaims?.metadata?.onboardingComplete &&
    !isOnboardingRoute(req) &&
    !isPublicApiCall
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
}
