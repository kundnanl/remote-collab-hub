import { router } from "./trpc";
import { userRouter } from "@/server/routes/users"

export const appRouter = router({
    user: userRouter,
});

export type AppRouter = typeof appRouter;