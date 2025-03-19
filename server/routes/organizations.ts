import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "../db";

export const organizationRouter = router({
    syncOrganization: protectedProcedure
      .input(
        z.object({
          clerkOrgId: z.string(),
          name: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { userId } = ctx.auth;
  
        if (!userId) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
  
        // Ensure the organization exists
        return prisma.organization.upsert({
          where: { clerkOrgId: input.clerkOrgId },
          update: { name: input.name },
          create: {
            clerkOrgId: input.clerkOrgId,
            name: input.name,
          },
        });
      }),
  
    addMember: protectedProcedure
      .input(
        z.object({
          clerkOrgId: z.string(),
          userId: z.string(),
          role: z.enum(["ADMIN", "MEMBER"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { userId: callerId } = ctx.auth;
  
        if (!callerId) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
  
        // Get organization from database
        const organization = await prisma.organization.findUnique({
          where: { clerkOrgId: input.clerkOrgId },
        });
  
        if (!organization) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
        }
  
        // Ensure user exists
        const user = await prisma.user.findUnique({
          where: { clerkId: input.userId },
        });
  
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
  
        // Add the user to the organization
        return prisma.organizationMember.upsert({
          where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
          update: { role: input.role },
          create: {
            userId: user.id,
            organizationId: organization.id,
            role: input.role,
          },
        });
      }),
  });
  