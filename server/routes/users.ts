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
        invitationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      console.log("[joinOrganization] userId:", userId);
      console.log("[joinOrganization] input:", input);
  
      const client = await clerkClient();
  
      let user;
      try {
        user = await prisma.user.findFirstOrThrow({
          where: { clerkId: userId },
        });
        console.log("[joinOrganization] Found user:", user.id);
      } catch (err) {
        console.error("[joinOrganization] Error finding user:", err);
        throw err;
      }
  
      let org;
      try {
        org = await prisma.organization.findUnique({
          where: { clerkOrgId: input.orgId },
        });
        if (!org) throw new Error("Organization not found in database.");
        console.log("[joinOrganization] Found org:", org.id);
      } catch (err) {
        console.error("[joinOrganization] Error finding org:", err);
        throw err;
      }
  
      try {
        const memberships = await client.users.getOrganizationMembershipList({
          userId
        });
        const alreadyMember = memberships.data.some(
          (m) => m.organization.id === input.orgId
        );
      
        if (!alreadyMember) {
          await client.organizations.createOrganizationMembership({
            organizationId: input.orgId,
            userId,
            role: "org:member",
          });
          console.log("[joinOrganization] Added user to Clerk org.");
        } else {
          console.log("[joinOrganization] User already in Clerk org.");
        }
      } catch (err) {
        console.error("[joinOrganization] Error checking/adding org membership:", err);
        throw err;
      }
        
      if (input.invitationId) {
        try {
          await client.invitations.revokeInvitation(input.invitationId);
          console.log("[joinOrganization] Revoked invitation:", input.invitationId);
        } catch (err) {
          console.warn("[joinOrganization] Failed to revoke invitation:", err);
        }
      }
  
      try {
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
          console.log("[joinOrganization] Added to DB org member table.");
        } else {
          console.log("[joinOrganization] User already in org member table.");
        }
      } catch (err) {
        console.error("[joinOrganization] Error updating org membership:", err);
        throw err;
      }
  
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            onboardingComplete: true,
          },
        });
        console.log("[joinOrganization] Marked onboarding complete in DB.");
      } catch (err) {
        console.error("[joinOrganization] Error updating user onboarding status:", err);
        throw err;
      }
  
      try {
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            onboardingComplete: true,
          },
        });
        console.log("[joinOrganization] Updated Clerk metadata.");
      } catch (err) {
        console.warn("[joinOrganization] Clerk metadata update failed:", err);
        // Not critical, don’t throw
      }
  
      return { success: true };
    }),
  });
