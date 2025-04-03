import { router } from "./trpc";
import { userRouter } from "@/server/routes/users"
import { docsRouter } from "@/server/routes/docs";

export const appRouter = router({
    user: userRouter,
    docs: docsRouter
});

export type AppRouter = typeof appRouter;