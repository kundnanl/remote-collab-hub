import { router } from "./trpc";
import { userRouter } from "@/server/routes/users"
import { docsRouter } from "@/server/routes/docs";
import { dashboardRouter } from "@/server/routes/dashboard";
import { officeRouter } from "@/server/routes/office";

export const appRouter = router({
    user: userRouter,
    docs: docsRouter,
    dashboard: dashboardRouter,
    office: officeRouter,
});

export type AppRouter = typeof appRouter;