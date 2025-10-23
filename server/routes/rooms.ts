import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createDailyRoom } from '@/lib/daily';

const RoomInput = z.object({
  name: z.string().min(1).max(64),
  kind: z.enum(['HUDDLE', 'MEETING', 'FOCUS', 'TEAM', 'CUSTOM']).default('HUDDLE'),
  isPersistent: z.boolean().default(true),
  capacity: z.number().int().min(1).max(50).nullable().optional(),
});

export const roomsRouter = router({
  listByOrg: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.prisma.room.findMany({
        where: { orgId: input.orgId },
        orderBy: { createdAt: 'asc' },
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
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      const dailyRoom = await createDailyRoom(`${input.orgId}-${Date.now()}-${input.data.name.toLowerCase()}`);

      return ctx.prisma.room.create({
        data: {
          orgId: input.orgId,
          name: input.data.name,
          kind: input.data.kind,
          isPersistent: input.data.isPersistent,
          capacity: input.data.capacity ?? null,
          createdBy: ctx.auth.userId!,
          rtcProvider: 'DAILY',
          rtcRoomName: dailyRoom.name,
          rtcRoomUrl: dailyRoom.url,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      roomId: z.string(),
      orgId: z.string(),
      data: RoomInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await ctx.prisma.organizationMember.findFirst({
        where: {
          organization: { clerkOrgId: input.orgId },
          user: { clerkId: ctx.auth.userId },
        },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

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
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      await ctx.prisma.recording.deleteMany({ where: { roomId: input.roomId } });
      await ctx.prisma.whiteboard.deleteMany({ where: { roomId: input.roomId } });
      await ctx.prisma.room.delete({ where: { id: input.roomId } });
      return { ok: true };
    }),
});
