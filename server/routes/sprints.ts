import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { Context } from "../context";

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

export const sprintsRouter = router({
  list: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.sprint.findMany({
        where: { orgId: input.orgId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        name: z.string().min(1).max(100),
        goal: z.string().max(500).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        velocityTarget: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.sprint.create({
        data: {
          orgId: input.orgId,
          name: input.name,
          goal: input.goal,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          velocityTarget: input.velocityTarget ?? null,
        },
      });
    }),

  start: protectedProcedure
    .input(z.object({ sprintId: z.string(), orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.sprint.update({
        where: { id: input.sprintId },
        data: {
          status: "ACTIVE",
          startDate: new Date(),
        },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ sprintId: z.string(), orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.sprint.update({
        where: { id: input.sprintId },
        data: {
          status: "CLOSED",
          endDate: new Date(),
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      sprintId: z.string(),
      name: z.string().min(1).max(100).optional(),
      goal: z.string().max(500).nullable().optional(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional(),
      velocityTarget: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.sprint.update({
        where: { id: input.sprintId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          goal: input.goal === undefined ? undefined : input.goal,
          startDate:
            input.startDate === undefined
              ? undefined
              : input.startDate
                ? new Date(input.startDate)
                : null,
          endDate:
            input.endDate === undefined
              ? undefined
              : input.endDate
                ? new Date(input.endDate)
                : null,
          velocityTarget:
            input.velocityTarget === undefined
              ? undefined
              : input.velocityTarget ?? null,
        },
      });
    }),
});
