import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

/** Clerk API types */
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

type ClerkOrganization = {
  id: string;
  name: string;
  created_by?: string;
};

type ClerkOrgMembership = {
  id: string;
  organization: { id: string };
  public_user_data: { user_id: string };
};

type ClerkWebhookEvent =
  | { type: "user.created"; data: ClerkUser }
  | { type: "user.updated"; data: ClerkUser }
  | { type: "user.deleted"; data: ClerkUser }
  | { type: "organization.created"; data: ClerkOrganization }
  | { type: "organization.updated"; data: ClerkOrganization }
  | { type: "organization.deleted"; data: ClerkOrganization }
  | { type: "organizationMembership.created"; data: ClerkOrgMembership }
  | { type: "organizationMembership.updated"; data: ClerkOrgMembership }
  | { type: "organizationMembership.deleted"; data: ClerkOrgMembership };

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

    const { type, data } = event;

    switch (type) {
      // ---------------------------
      // User events
      // ---------------------------
      case "user.created": {
        const user = data as ClerkUser;
        const imageUrl =
          user.has_image && user.image_url
            ? user.image_url
            : "https://ui-avatars.com/api/?name=User";

        await prisma.user.upsert({
          where: { clerkId: user.id },
          update: {},
          create: {
            clerkId: user.id,
            email: user.email_addresses?.[0]?.email_address ?? "",
            name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
            imageUrl,
          },
        });
        break;
      }

      case "user.updated": {
        const user = data as ClerkUser;
        const imageUrl =
          user.has_image && user.image_url
            ? user.image_url
            : "https://ui-avatars.com/api/?name=User";

        await prisma.user.updateMany({
          where: { clerkId: user.id },
          data: {
            email: user.email_addresses?.[0]?.email_address ?? "",
            name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
            imageUrl,
          },
        });
        break;
      }

      case "user.deleted": {
        const user = data as ClerkUser;
        await prisma.user.deleteMany({
          where: { clerkId: user.id },
        });
        break;
      }

      // ---------------------------
      // Organization events
      // ---------------------------
      case "organization.created": {
        const org = data as ClerkOrganization;

        // 1. Upsert the org
        const createdOrg = await prisma.organization.upsert({
          where: { clerkOrgId: org.id },
          update: { name: org.name },
          create: {
            clerkOrgId: org.id,
            name: org.name,
          },
        });

        if (org.created_by) {
          const user = await prisma.user.findUnique({
            where: { clerkId: org.created_by },
          });

          if (user) {
            await prisma.organizationMember.upsert({
              where: {
                userId_organizationId: {
                  userId: user.id,
                  organizationId: createdOrg.id,
                },
              },
              update: {},
              create: {
                userId: user.id,
                organizationId: createdOrg.id,
              },
            });
          }
        }

        break;
      }

      case "organization.updated": {
        const org = data as ClerkOrganization;
        await prisma.organization.updateMany({
          where: { clerkOrgId: org.id },
          data: { name: org.name },
        });
        break;
      }

      case "organization.deleted": {
        const org = data as ClerkOrganization;
        await prisma.organization.deleteMany({
          where: { clerkOrgId: org.id },
        });
        break;
      }

      // ---------------------------
      // Membership events
      // ---------------------------
      case "organizationMembership.created": {
        const membership = data as ClerkOrgMembership;
        const userClerkId = membership.public_user_data?.user_id;
        const orgClerkId = membership.organization.id;

        if (!userClerkId || !orgClerkId) {
          console.warn("⚠️ Skipping membership.created: missing userId/orgId");
          break;
        }

        // Ensure both User + Org exist
        const user = await prisma.user.findUnique({ where: { clerkId: userClerkId } });
        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: orgClerkId },
        });

        if (!user || !org) {
          console.warn(
            "⚠️ Skipping membership.created: missing user or org in DB",
            { userClerkId, orgClerkId }
          );
          break;
        }

        await prisma.organizationMember.upsert({
          where: {
            userId_organizationId: {
              userId: user.id, // ✅ internal ID
              organizationId: org.id, // ✅ internal ID
            },
          },
          update: {},
          create: {
            userId: user.id, // ✅
            organizationId: org.id, // ✅
          },
        });

        break;
      }

      case "organizationMembership.deleted": {
        const membership = data as ClerkOrgMembership;
        const userClerkId = membership.public_user_data?.user_id;
        const orgClerkId = membership.organization.id;

        if (!userClerkId || !orgClerkId) {
          console.warn("⚠️ Skipping membership.deleted: missing userId/orgId");
          break;
        }

        const user = await prisma.user.findUnique({ where: { clerkId: userClerkId } });
        const org = await prisma.organization.findUnique({
          where: { clerkOrgId: orgClerkId },
        });

        if (!user || !org) {
          console.warn(
            "⚠️ Skipping membership.deleted: missing user or org in DB",
            { userClerkId, orgClerkId }
          );
          break;
        }

        await prisma.organizationMember.deleteMany({
          where: { userId: user.id, organizationId: org.id },
        });

        break;
      }

      default:
        console.log("ℹ️ Unhandled webhook event:", type);
        break;
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
