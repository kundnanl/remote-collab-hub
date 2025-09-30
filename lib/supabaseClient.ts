import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  throw new Error('Supabase env not configured')
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    global: {
      headers: {
        'x-rc-hub': 'presence-v1',
      },
    },
  }
)

console.log('[supabase] client created', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40) + '…',
})
