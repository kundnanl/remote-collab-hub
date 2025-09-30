import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { Context } from "../context";
import { TaskStatus } from "@prisma/client";

const ensureMember = async (ctx: Context, orgId: string) => {
  const member = await ctx.prisma.organizationMember.findFirst({
    where: {
      organization: { clerkOrgId: orgId },
      user: { clerkId: ctx.auth.userId ?? undefined },
    },
    select: { id: true },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
};

export const boardsRouter = router({
  getDefault: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.board.findFirst({
        where: { orgId: input.orgId, name: "Default" },
        include: { columns: { orderBy: { position: "asc" } } },
      });
    }),

  createDefaultIfMissing: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);

      let board = await ctx.prisma.board.findFirst({
        where: { orgId: input.orgId, name: "Default" },
      });

      if (!board) {
        board = await ctx.prisma.board.create({ data: { orgId: input.orgId, name: "Default" } });
      }

      const defaults: { title: string; status: TaskStatus; position: number }[] = [
        { title: "Backlog", status: TaskStatus.BACKLOG, position: 0 },
        { title: "To do", status: TaskStatus.TODO, position: 1 },
        { title: "In progress", status: TaskStatus.IN_PROGRESS, position: 2 },
        { title: "Review", status: TaskStatus.REVIEW, position: 3 },
        { title: "Done", status: TaskStatus.DONE, position: 4 },
      ];

      for (const col of defaults) {
        const exists = await ctx.prisma.boardColumn.findFirst({
          where: { boardId: board.id, status: col.status },
        });
        if (!exists) {
          await ctx.prisma.boardColumn.create({
            data: {
              boardId: board.id,
              title: col.title,
              status: col.status,
              position: col.position,
            },
          });
        }
      }

      return ctx.prisma.board.findUnique({
        where: { id: board.id },
        include: { columns: { orderBy: { position: "asc" } } },
      });
    }),

  updateColumns: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        orgId: z.string(),
        updates: z.array(
          z.object({
            id: z.string(),
            title: z.string().min(1).max(64).optional(),
            status: z.nativeEnum(TaskStatus).optional(),
            wipLimit: z.number().int().min(1).max(99).nullable().optional(),
            position: z.number().int().min(0).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);

      const board = await ctx.prisma.board.findFirst({
        where: { id: input.boardId, orgId: input.orgId },
      });
      if (!board) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.$transaction(
        input.updates.map((u) =>
          ctx.prisma.boardColumn.update({
            where: { id: u.id },
            data: {
              title: u.title ?? undefined,
              status: u.status ?? undefined,
              wipLimit: u.wipLimit === undefined ? undefined : u.wipLimit,
              position: u.position ?? undefined,
            },
          })
        )
      );

      return ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        include: { columns: { orderBy: { position: "asc" } } },
      });
    }),

  createColumn: protectedProcedure
    .input(z.object({ boardId: z.string(), orgId: z.string(), title: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      const max = await ctx.prisma.boardColumn.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      return ctx.prisma.boardColumn.create({
        data: {
          boardId: input.boardId,
          title: input.title,
          status: "TODO", 
          position: (max?.position ?? -1) + 1,
        },
      });
    }),

  deleteColumn: protectedProcedure
    .input(z.object({ columnId: z.string(), orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      // move tasks out of the column (to null) or another default
      await ctx.prisma.task.updateMany({ where: { columnId: input.columnId }, data: { columnId: null } });
      await ctx.prisma.boardColumn.delete({ where: { id: input.columnId } });
      return { ok: true };
    }),
});


