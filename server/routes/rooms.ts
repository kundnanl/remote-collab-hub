// server/routes/rooms.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc"; // adjust to your helpers
import { TRPCError } from "@trpc/server";

const RoomInput = z.object({
  name: z.string().min(1).max(64),
  kind: z
    .enum(["HUDDLE", "MEETING", "FOCUS", "TEAM", "CUSTOM"])
    .default("HUDDLE"),
  isPersistent: z.boolean().default(true),
  capacity: z.number().int().min(1).max(50).nullable().optional(),
});

export const roomsRouter = router({
  listByOrg: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ensure user is member of org
      const member = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.room.findMany({
        where: { orgId: input.orgId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ orgId: z.string(), data: RoomInput }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.room.create({
        data: {
          orgId: input.orgId,
          name: input.data.name,
          kind: input.data.kind,
          isPersistent: input.data.isPersistent,
          capacity: input.data.capacity ?? null,
          createdBy: ctx.auth.userId!,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        orgId: z.string(),
        data: RoomInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.room.update({
        where: { id: input.roomId },
        data: input.data,
      });
    }),

  remove: protectedProcedure
    .input(z.object({ roomId: z.string(), orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.prisma.roomSession.deleteMany({
        where: { roomId: input.roomId },
      });
      await ctx.prisma.room.delete({ where: { id: input.roomId } });
      return { ok: true };
    }),

  activeSession: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.roomSession.findFirst({
        where: { roomId: input.roomId, endedAt: null },
        select: { id: true, startedAt: true, startedBy: true },
        orderBy: { startedAt: "desc" },
      });
    }),

  startOrGetActiveSession: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // find active
      const existing = await ctx.prisma.roomSession.findFirst({
        where: { roomId: input.roomId, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (existing) return existing;

      return ctx.prisma.roomSession.create({
        data: { roomId: input.roomId, startedBy: ctx.auth.userId! },
      });
    }),

  endActiveSession: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const active = await ctx.prisma.roomSession.findFirst({
        where: { roomId: input.roomId, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (!active) return { ok: true, ended: false };
      await ctx.prisma.roomSession.update({
        where: { id: active.id },
        data: { endedAt: new Date() },
      });
      return { ok: true, ended: true };
    }),
});
