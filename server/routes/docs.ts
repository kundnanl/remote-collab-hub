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
      });

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
});
