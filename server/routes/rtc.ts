import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { createMeetingToken } from "@/lib/daily";

export const rtcRouter = router({
    getToken: protectedProcedure
        .input(z.object({ roomId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const { userId } = ctx.auth;
            if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

            const room = await ctx.prisma.room.findUnique({
                where: { id: input.roomId },
                include: { organization: true },
            });
            if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "room-not-found" });

            const user = await ctx.prisma.user.findUnique({
                where: { clerkId: userId },
            });
            if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

            const membership = await ctx.prisma.organizationMember.findFirst({
                where: {
                    organization: { clerkOrgId: room.orgId },
                    user: { clerkId: ctx.auth.userId },
                },

            });
            if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

            if (!room.rtcRoomName || !room.rtcRoomUrl) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "rtc-not-configured" });
            }

            const isOwner = room.createdBy === userId;
            const tokenRes = await createMeetingToken({
                room_name: room.rtcRoomName,
                is_owner: isOwner,
                user_name: user?.name ?? "Guest",
            });

            return { token: tokenRes.token, url: room.rtcRoomUrl };
        }),
});
