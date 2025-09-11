import { TRPCError } from "@trpc/server";

import { prisma } from "@/server/db";
import { middleware } from "../trpc";

export const requireOnboardingComplete = middleware(async ({ ctx, next }) => {
  const { userId } = ctx.auth;

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      name: true,
      onboardingComplete: true,
    },
  });

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!user.onboardingComplete) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Onboarding is required before accessing this resource.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});
