import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/server/db";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

export const userRouter = router({
  syncUser: protectedProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx.auth;

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

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
      const userId = ctx.auth.userId;
      const user = await prisma.user.findFirstOrThrow({
        where: { clerkId: userId },
      });

      const client = await clerkClient();

      const org = await client.organizations.createOrganization({
        name: input.orgName,
        createdBy: userId,
      });

      await prisma.organization.create({
        data: {
          name: input.orgName,
          clerkOrgId: org.id,
          members: {
            create: { userId: user.id },
          },
        },
      });

      await client.users.updateUser(userId, {
        publicMetadata: { onboardingComplete: true },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingComplete: true },
      });

      return { success: true };
    }),

  joinOrganization: protectedProcedure
    .input(
      z.object({
        orgId: z.string().min(1),
        invitationId: z.string().optional(), // <- Add this
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      const client = await clerkClient();

      const user = await prisma.user.findFirstOrThrow({
        where: { clerkId: userId },
      });

      const org = await prisma.organization.findUnique({
        where: { clerkOrgId: input.orgId },
      });

      if (!org) throw new Error("Organization not found in database.");

      // ✅ Add to Clerk org
      await client.organizations.createOrganizationMembership({
        organizationId: input.orgId,
        userId,
        role: "org:member",
      });

      // ✅ Revoke invite if it exists
      if (input.invitationId) {
        await client.invitations.revokeInvitation(input.invitationId);
      }

      // ✅ Add to your DB if not already
      const existing = await prisma.organizationMember.findFirst({
        where: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      if (!existing) {
        await prisma.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: org.id,
          },
        });
      }

      // ✅ Mark onboarding complete in DB
      await prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingComplete: true,
        },
      });

      // ✅ Also in Clerk metadata
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          onboardingComplete: true,
        },
      });

      return { success: true };
    }),
});
