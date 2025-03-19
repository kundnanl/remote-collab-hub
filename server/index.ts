import { organizationRouter } from "@/server/routes/organizations";
import { router } from "./trpc";
import { userRouter } from "@/server/routes/users"

export const appRouter = router({
    user: userRouter,
    organization: organizationRouter
});

export type AppRouter = typeof appRouter;