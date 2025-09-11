import { router, protectedProcedure } from "../trpc";
import { requireOnboardingComplete } from "../middlewares/requireOnboardingComplete";

export const dashboardRouter = router({
  getUserDashboard: protectedProcedure
    .use(requireOnboardingComplete)
    .query(async ({ ctx }) => {
      return {
        message: `Welcome back, ${ctx.user.name ?? "User"}!`,
        userId: ctx.user.id,
      };
    }),

  getDocuments: protectedProcedure
    .use(requireOnboardingComplete)
    .query(async ({ ctx }) => {
      return await ctx.prisma.document.findMany({
        where: { ownerId: ctx.user.id },
      });
    }),
});
