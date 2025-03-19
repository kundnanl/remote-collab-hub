import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/server/db";
import { clerkClient } from "@clerk/nextjs/server";

export const userRouter = router({
  syncUser: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { userId } = ctx.auth;

      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId)

      return prisma.user.upsert({
        where: { clerkId: userId },
        update: { email: clerkUser.emailAddresses[0]?.emailAddress },
        create: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: clerkUser.firstName,
        },
      });
    }),
});
