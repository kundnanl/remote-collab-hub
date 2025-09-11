import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

type ClerkEmailAddress = {
  email_address: string;
};

type ClerkUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  has_image: boolean;
  image_url?: string | null;
  email_addresses: ClerkEmailAddress[];
};

type ClerkWebhookEvent =
  | { type: "user.created"; data: ClerkUser }
  | { type: "user.updated"; data: ClerkUser }
  | { type: "user.deleted"; data: ClerkUser };

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    let event: ClerkWebhookEvent;
    try {
      event = JSON.parse(rawBody) as ClerkWebhookEvent;
    } catch (err) {
      console.error("❌ Failed to parse JSON:", err, rawBody);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { type, data: user } = event;

    if (type === "user.created") {
      const imageUrl =
        user.has_image && user.image_url
          ? user.image_url
          : "https://ui-avatars.com/api/?name=User";

      await prisma.user.create({
        data: {
          clerkId: user.id,
          email: user.email_addresses?.[0]?.email_address ?? "",
          name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
          imageUrl,
        },
      });
    }

    if (type === "user.updated") {
      const imageUrl =
        user.has_image && user.image_url
          ? user.image_url
          : "https://ui-avatars.com/api/?name=User";

      await prisma.user.update({
        where: { clerkId: user.id },
        data: {
          email: user.email_addresses?.[0]?.email_address ?? "",
          name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
          imageUrl,
        },
      });
    }

    if (type === "user.deleted") {
      await prisma.user.deleteMany({
        where: { clerkId: user.id },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("❌ Webhook error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
