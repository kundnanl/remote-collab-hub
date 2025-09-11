import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import { prisma } from "../db";

export const officeRouter = router({
  // Get virtual office by org ID
  getOfficeByOrg: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      return prisma.virtualOffice.findUnique({
        where: { organizationId: input.organizationId },
        include: {
          rooms: {
            include: {
              members: {
                include: { user: true },
              },
            },
          },
        },
      });
    }),

  // Create a room
  createRoom: protectedProcedure
    .input(
      z.object({
        officeId: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.room.create({
        data: {
          name: input.name,
          description: input.description,
          officeId: input.officeId,
        },
      });
    }),

  // List rooms in a virtual office
  listRooms: protectedProcedure
    .input(z.object({ officeId: z.string() }))
    .query(async ({ input }) => {
      return prisma.room.findMany({
        where: { officeId: input.officeId },
        include: {
          members: { include: { user: true } },
        },
      });
    }),

      // Join a room
  joinRoom: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.roomMember.upsert({
        where: {
          user_in_room_unique: {
            roomId: input.roomId,
            userId: input.userId,
          },
        },
        update: {
          status: "ONLINE",
          joinedAt: new Date(),
          leftAt: null,
        },
        create: {
          roomId: input.roomId,
          userId: input.userId,
          status: "ONLINE",
        },
      });
    }),

  // Leave a room
  leaveRoom: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.roomMember.update({
        where: {
          user_in_room_unique: {
            roomId: input.roomId,
            userId: input.userId,
          },
        },
        data: {
          status: "OFFLINE",
          leftAt: new Date(),
        },
      });
    }),

  // Update status (ONLINE, OFFLINE, IDLE, IN_MEETING)
  updateStatus: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        userId: z.string(),
        status: z.enum(["ONLINE", "OFFLINE", "IDLE", "IN_MEETING"]),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.roomMember.update({
        where: {
          user_in_room_unique: {
            roomId: input.roomId,
            userId: input.userId,
          },
        },
        data: {
          status: input.status,
        },
      });
    }),

  // Get current members of a room
  getRoomMembers: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .query(async ({ input }) => {
      return prisma.roomMember.findMany({
        where: { roomId: input.roomId },
        include: { user: true },
      });
    }),
});
