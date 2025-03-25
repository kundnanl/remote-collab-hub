import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/server/db";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from 'zod'


export const userRouter = router({
  syncUser: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { userId } = ctx.auth;

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId)

      return prisma.user.upsert({
        where: { clerkId: userId },
        update: { email: clerkUser.emailAddresses[0]?.emailAddress },
        create: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: clerkUser.firstName,
        },
      });
    }),

    completeOnboarding: protectedProcedure
    .input(z.object({ orgName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId
      const user = await prisma.user.findFirstOrThrow({
        where: { clerkId: userId },
      })

      const client = await clerkClient()

      // Create organization in Clerk
      const org = await client.organizations.createOrganization({
        name: input.orgName,
        createdBy: userId,
      })

      // Save to Prisma
      await prisma.organization.create({
        data: {
          name: input.orgName,
          clerkOrgId: org.id,
          members: {
            create: {
              userId: user.id,
            },
          },
        },
      })

      // Update Clerk public metadata
      await client.users.updateUser(userId, {
        publicMetadata: {
          onboardingComplete: true,
        },
      })

      // Update our Prisma record too
      await prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingComplete: true,
        },
      })

      return { success: true }
    }),
});
