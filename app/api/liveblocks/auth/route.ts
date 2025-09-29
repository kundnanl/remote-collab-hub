import { NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { auth, clerkClient } from "@clerk/nextjs/server";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

// This endpoint receives { room: string } from the Liveblocks client.
// It must return an auth token with the allowed room & user info.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { room } = await req.json().catch(() => ({}));
  if (!room || typeof room !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  // Pull user meta from Clerk to enrich presence
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.emailAddresses[0]?.emailAddress ||
    "Anonymous";

  const avatar = user.imageUrl ?? undefined;

  // Start a Liveblocks session for this user
  const session = liveblocks.prepareSession(userId, {
    userInfo: { name, avatar }, // becomes `others[i].info`
  });

  // Grant full access to this concrete room id
  session.allow(room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
