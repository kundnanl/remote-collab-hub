import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { Context } from "../context";
import { Prisma, TaskPriority, TaskType } from "@prisma/client";

// Utility: ensure user is member of org
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

// Zod schema
const TaskCreateInput = z.object({
  orgId: z.string(),
  title: z.string().min(1).max(140),
  description: z.string().max(50_000).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  type: z.nativeEnum(TaskType).optional(),
  assigneeId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  columnId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  estimate: z.number().int().min(0).nullable().optional(),
});

const TaskUpdateInput = z.object({
  taskId: z.string(),
  data: z.object({
    title: z.string().min(1).max(140).optional(),
    description: z.string().max(50_000).nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    type: z.nativeEnum(TaskType).optional(),
    assigneeId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    columnId: z.string().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    estimate: z.number().int().min(0).nullable().optional(),
    position: z.number().int().min(0).optional(),
  }),
});

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        columnId: z.string().nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        sprintId: z.string().nullable().optional(),
        query: z.string().max(200).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.task.findMany({
        where: {
          orgId: input.orgId,
          columnId: input.columnId ?? undefined,
          assigneeId: input.assigneeId ?? undefined,
          sprintId: input.sprintId ?? undefined,
          ...(input.query
            ? { title: { contains: input.query, mode: "insensitive" as const } }
            : {}),
        },
        orderBy: [{ columnId: "asc" }, { position: "asc" }, { createdAt: "desc" }],
      });
    }),

  byId: protectedProcedure
    .input(z.object({ taskId: z.string(), orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      const task = await ctx.prisma.task.findFirst({
        where: { id: input.taskId, orgId: input.orgId },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  create: protectedProcedure
    .input(TaskCreateInput)
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);

      let position = 0;
      if (input.columnId) {
        const last = await ctx.prisma.task.findFirst({
          where: { orgId: input.orgId, columnId: input.columnId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        position = (last?.position ?? -1) + 1;
      }

      const task = await ctx.prisma.task.create({
        data: {
          orgId: input.orgId,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? TaskPriority.MEDIUM,
          type: input.type ?? TaskType.FEATURE,
          createdBy: ctx.auth.userId!,
          assigneeId: input.assigneeId ?? null,
          sprintId: input.sprintId ?? null,
          columnId: input.columnId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          estimate: input.estimate ?? null,
          position,
        },
      });

      await ctx.prisma.taskActivity.create({
        data: {
          taskId: task.id,
          orgId: input.orgId,
          actorId: ctx.auth.userId!,
          type: "CREATED",
          meta: { title: task.title } as Prisma.InputJsonValue,
        },
      });

      return task;
    }),

  update: protectedProcedure
    .input(TaskUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findUnique({ where: { id: input.taskId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ensureMember(ctx, existing.orgId);

      const updated = await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: {
          ...("title" in input.data ? { title: input.data.title! } : {}),
          description:
            input.data.description === undefined ? undefined : input.data.description,
          priority: input.data.priority,
          type: input.data.type,
          assigneeId: input.data.assigneeId,
          sprintId: input.data.sprintId,
          columnId: input.data.columnId,
          dueDate:
            input.data.dueDate === undefined
              ? undefined
              : input.data.dueDate
              ? new Date(input.data.dueDate)
              : null,
          startDate:
            input.data.startDate === undefined
              ? undefined
              : input.data.startDate
              ? new Date(input.data.startDate)
              : null,
          estimate: input.data.estimate,
          position: input.data.position,
        },
      });

      await ctx.prisma.taskActivity.create({
        data: {
          taskId: updated.id,
          orgId: existing.orgId,
          actorId: ctx.auth.userId!,
          type: "UPDATED",
          meta: input.data as Prisma.InputJsonValue,
        },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId } });
      if (!task) return { ok: true, deleted: false };
      await ensureMember(ctx, task.orgId);

      await ctx.prisma.$transaction([
        ctx.prisma.taskRelation.deleteMany({
          where: { OR: [{ fromId: task.id }, { toId: task.id }] },
        }),
        ctx.prisma.taskComment.deleteMany({ where: { taskId: task.id } }),
        ctx.prisma.taskActivity.deleteMany({ where: { taskId: task.id } }),
        ctx.prisma.task.delete({ where: { id: task.id } }),
      ]);

      return { ok: true, deleted: true };
    }),

  move: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        toColumnId: z.string().nullable(),
        toIndex: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      await ensureMember(ctx, task.orgId);

      const fromColumnId = task.columnId;
      const toColumnId = input.toColumnId ?? null;

      const siblings = await ctx.prisma.task.findMany({
        where: { orgId: task.orgId, columnId: toColumnId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      const newOrder = [...siblings.map((s) => s.id)];
      const idxExisting = newOrder.indexOf(task.id);
      if (idxExisting !== -1) newOrder.splice(idxExisting, 1);
      newOrder.splice(Math.min(input.toIndex, newOrder.length), 0, task.id);

      await ctx.prisma.$transaction(
        newOrder.map((id, index) =>
          ctx.prisma.task.update({ where: { id }, data: { columnId: toColumnId, position: index } })
        )
      );

      await ctx.prisma.taskActivity.create({
        data: {
          taskId: task.id,
          orgId: task.orgId,
          actorId: ctx.auth.userId!,
          type: "MOVED",
          meta: { fromColumnId, toColumnId, toIndex: input.toIndex } as Prisma.InputJsonValue,
        },
      });

      return ctx.prisma.task.findUnique({ where: { id: task.id } });
    }),
});