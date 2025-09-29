// src/lib/liveblocks.ts (client-side)
"use client";
import { createClient } from "@liveblocks/client";

export const liveblocksClient = createClient({
  // Use server auth for dev/prod (token returned from /api/liveblocks/auth)
  authEndpoint: "/api/liveblocks/auth",
  // If you ever switch to public key mode:
  // publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
});
