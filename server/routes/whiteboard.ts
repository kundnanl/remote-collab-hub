// src/server/routers/whiteboards.ts
import { router, protectedProcedure } from "../trpc";
import { z } from "zod";

export const whiteboardsRouter = router({
  /** Create (if missing) and return a whiteboard for a given Room */
  getOrCreate: protectedProcedure
    .input(z.object({ roomId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { prisma, auth } = ctx;
      const userId = auth.userId!;
      // 1) Load the Room (and org) + verify membership
      const room = await prisma.room.findUnique({
        where: { id: input.roomId },
        include: { organization: true },
      });
      if (!room) throw new Error("room-not-found");

      const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (!dbUser) throw new Error("user-not-in-db");

      const dbOrg = await prisma.organization.findUnique({
        where: { clerkOrgId: room.orgId },
      });
      if (!dbOrg) throw new Error("org-not-in-db");

      const member = await prisma.organizationMember.findFirst({
        where: { userId: dbUser.id, organizationId: dbOrg.id },
      });
      if (!member) throw new Error("forbidden");

      // 2) Ensure there's a whiteboard row for this room
      let whiteboard = await prisma.whiteboard.findFirst({
        where: { roomId: room.id },
      });

      if (!whiteboard) {
        // Use a stable Liveblocks room id; include org to avoid collisions across orgs
        const storageKey = `org:${room.orgId}:room:${room.id}:board:default`;
        whiteboard = await prisma.whiteboard.create({
          data: {
            roomId: room.id,
            storageKey,
            title: "Board",
          },
        });
      }

      return {
        storageKey: whiteboard.storageKey, // <- Liveblocks room id
        title: whiteboard.title,
      };
    }),
});
