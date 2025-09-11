import { initTRPC, TRPCError } from '@trpc/server'
import { Context } from './context'

const t = initTRPC.context<Context>().create()

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      auth: ctx.auth,
    },
  })
})

const requireOrg = t.middleware(({ next, ctx }) => {
  if (!ctx.orgId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Missing organization context.',
    })
  }
  return next({
    ctx: {
      ...ctx,
      orgId: ctx.orgId,
    },
  })
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
export const protectedOrgProcedure = t.procedure.use(requireOrg)
export const middleware = t.middleware  