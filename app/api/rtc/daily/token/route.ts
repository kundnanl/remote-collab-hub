import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";
import { createMeetingToken } from "@/lib/daily";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { roomId?: string };
    if (!body?.roomId) {
      return NextResponse.json({ error: "missing-roomId" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: body.roomId },
      include: { organization: true },
    });
    if (!room) {
      return NextResponse.json({ error: "room-not-found" }, { status: 404 });
    }

    // ✅ ensure user is a member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: room.orgId,
        userId: userId,
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (!room.rtcRoomName || !room.rtcRoomUrl) {
      return NextResponse.json({ error: "rtc-not-configured" }, { status: 400 });
    }

    // load user profile for display name
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });

    const isOwner = room.createdBy === userId;
    const tokenRes = await createMeetingToken({
      room_name: room.rtcRoomName,
      is_owner: isOwner,
      user_name: user?.name ?? "Guest",
      // start_cloud_recording: true can be toggled later via UI
    });

    return NextResponse.json({ token: tokenRes.token, url: room.rtcRoomUrl });
  } catch (err) {
    console.error("daily token endpoint error", err);
    return NextResponse.json({ error: "internal-server-error" }, { status: 500 });
  }
}
