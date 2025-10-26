import { protectedProcedure, router } from "../trpc";
import { z } from "zod";
import { prisma } from "../db";
import { TRPCError } from "@trpc/server";

export const docsRouter = router({
  createDocument: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, orgId } = ctx;

      if (!orgId) {
        throw new Error("No organization context found.");
      }

      if (!userId) {
        throw new Error("Missing user ID");
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });

      if (!user) {
        throw new Error("User not found in database.");
      }

      const document = await prisma.document.create({
        data: {
          title: input.title,
          content: input.content ?? {},
          ownerId: user.clerkId,
          orgId: orgId,
          permissions: {
            create: {
              userId: user.clerkId,
              role: "OWNER",
            },
          },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        success: true,
        document,
      };
    }),

  getMyDocuments: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    if (!userId) {
      throw new Error("No UserId found in DB");
    }

    const docs = await prisma.permission.findMany({
      where: {
        userId,
      },
      include: {
        document: true,
      },
      orderBy: {
        document: {
          updatedAt: "desc",
        },
      },
    });

    return docs.map((perm) => ({
      id: perm.document.id,
      title: perm.document.title,
      createdAt: perm.document.createdAt,
      role: perm.role,
      updatedAt: perm.document.updatedAt,
    }));
  }),

  getDocumentById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const doc = await prisma.document.findUnique({
        where: { id: input.id },
        include: {
          permissions: true,
        },
      });

      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      const permission = doc.permissions.find(
        (p) => p.userId === ctx.auth.userId
      );
      if (!permission) throw new TRPCError({ code: "FORBIDDEN" });

      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        canEdit: permission.role === "OWNER" || permission.role === "EDITOR",
      };
    }),

  updateContent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const doc = await prisma.document.update({
        where: { id: input.id },
        data: { content: input.content },
      });

      return { success: true, updatedAt: doc.updatedAt };
    }),

  recent: protectedProcedure
    .input(z.object({ orgId: z.string(), limit: z.number().min(1).max(50).default(8) }))
    .query(async ({ input, ctx }) => {
      // ensure org is the same as ctx
      if (!ctx.orgId || ctx.orgId !== input.orgId) throw new TRPCError({ code: "FORBIDDEN" });

      const docs = await prisma.document.findMany({
        where: { orgId: input.orgId },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
      });

      return { docs };
    }),

});
