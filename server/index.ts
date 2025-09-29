import { router } from "./trpc";
import { userRouter } from "@/server/routes/users";
import { docsRouter } from "@/server/routes/docs";
import { dashboardRouter } from "@/server/routes/dashboard";
import { roomsRouter } from "@/server/routes/rooms";
import { createContext } from "@/server/context";
import { boardsRouter } from "@/server/routes/boards";
import { tasksRouter } from "@/server/routes/tasks";
import { sprintsRouter } from "@/server/routes/sprints";
import { rtcRouter } from "@/server/routes/rtc";


export const appRouter = router({
  user: userRouter,
  docs: docsRouter,
  dashboard: dashboardRouter,
  rooms: roomsRouter,
  boards: boardsRouter,
  tasks: tasksRouter,
  sprints: sprintsRouter,
  rtc: rtcRouter,
});

export type AppRouter = typeof appRouter;

export async function createCaller() {
  const ctx = await createContext();
  return appRouter.createCaller(ctx);
}
