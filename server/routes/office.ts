import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import { prisma } from "../db";

export const officeRouter = router({
  // Get or create Virtual Office for an organization
  getOrCreateOffice: protectedProcedure
    .input(z.object({ organizationId: z.string() })) // This is the Clerk org ID
    .mutation(async ({ input }) => {
      return prisma.$transaction(async (tx) => {
        // First ensure the organization exists
        const organization = await tx.organization.upsert({
          where: { clerkOrgId: input.organizationId },
          update: {},
          create: {
            clerkOrgId: input.organizationId,
            name: "Default Org Name",
          },
        });

        // Then create/get the virtual office
        return tx.virtualOffice.upsert({
          where: { organizationId: organization.id }, // Use internal ID
          update: {},
          create: {
            organizationId: organization.id, // Use internal ID
          },
          include: { rooms: true },
        });
      });
    }),
  createRoom: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(), // This is the Clerk org ID
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Use a transaction to ensure atomicity
      return prisma.$transaction(async (tx) => {
        // First, find or create the organization
        const organization = await tx.organization.upsert({
          where: { clerkOrgId: input.organizationId },
          update: {},
          create: {
            clerkOrgId: input.organizationId,
            name: "Default Org Name",
          },
        });

        // Then create/find the virtual office using the organization's internal ID
        const office = await tx.virtualOffice.upsert({
          where: { organizationId: organization.id }, // Use internal ID here
          update: {},
          create: {
            organizationId: organization.id, // Use internal ID here
          },
        });

        // Finally create the room
        return tx.room.create({
          data: {
            name: input.name,
            description: input.description,
            officeId: office.id,
          },
        });
      });
    }),

  // List rooms
  listRooms: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      return prisma.room.findMany({
        where: {
          virtualOffice: { organizationId: input.organizationId },
        },
        include: { members: { include: { user: true } } },
      });
    }),

  // --- presence/members as you had ---
  joinRoom: protectedProcedure
    .input(z.object({ roomId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.roomMember.upsert({
        where: {
          user_in_room_unique: {
            roomId: input.roomId,
            userId: input.userId,
          },
        },
        update: { status: "ONLINE", joinedAt: new Date(), leftAt: null },
        create: { roomId: input.roomId, userId: input.userId, status: "ONLINE" },
      });
    }),

  leaveRoom: protectedProcedure
    .input(z.object({ roomId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.roomMember.update({
        where: {
          user_in_room_unique: {
            roomId: input.roomId,
            userId: input.userId,
          },
        },
        data: { status: "OFFLINE", leftAt: new Date() },
      });
    }),

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
        data: { status: input.status },
      });
    }),

  getRoomMembers: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .query(async ({ input }) => {
      return prisma.roomMember.findMany({
        where: { roomId: input.roomId },
        include: { user: true },
      });
    }),
});