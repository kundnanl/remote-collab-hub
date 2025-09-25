import { createTRPCReact } from "@trpc/react-query"
import type { inferRouterOutputs } from '@trpc/server'

import { AppRouter } from "@/server"

export const trpc = createTRPCReact<AppRouter>();
export type RouterOutputs = inferRouterOutputs<AppRouter>

export type RoomOutput = RouterOutputs['rooms']['listByOrg'][number]