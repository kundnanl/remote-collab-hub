import { router } from "./trpc";
import { userRouter } from "@/server/routes/users"
import { docsRouter } from "@/server/routes/docs";
import { dashboardRouter } from "@/server/routes/dashboard";
import { officeRouter } from "@/server/routes/office";
import { roomsRouter } from "@/server/routes/rooms";
import { createContext } from '@/server/context';

export const appRouter = router({
    user: userRouter,
    docs: docsRouter,
    dashboard: dashboardRouter,
    office: officeRouter,
    rooms: roomsRouter
});

export type AppRouter = typeof appRouter;

export async function createCaller() {
  const ctx = await createContext()
  return appRouter.createCaller(ctx)
}
