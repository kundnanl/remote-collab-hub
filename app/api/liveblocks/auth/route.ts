import { Liveblocks } from "@liveblocks/node";
import { currentUser } from "@clerk/nextjs/server";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: Request) {
  const u = await currentUser();
  const { room } = await req.json();

  const name =
    `${u?.firstName || ""} ${u?.lastName || ""}`.trim() ||
    u?.username ||
    u?.emailAddresses?.[0]?.emailAddress ||
    "Anonymous";

  const session = liveblocks.prepareSession(u?.id ?? "anon", {
    // 👇 This is what the client reads via useSelf((me) => me.info)
    userInfo: {
      name,
      color: "#6366f1",
      picture: u?.imageUrl ?? "",
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { body, status } = await session.authorize();
  return new Response(body, { status });
}
