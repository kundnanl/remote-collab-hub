"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";

export const completeOnboarding = async (formData: FormData) => {
  const { userId } = await auth();

  if (!userId) {
    return { message: "No Logged In User" };
  }

  try {
    // Fetch user from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId)

    // Ensure user exists in Prisma
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: clerkUser.firstName || "",
        },
      });
    }

    // Create or update organization using clerkOrgId (not name)
    const clerkOrgId = `org_${user.id}`; // Mocked for now, replace with actual Clerk org ID if available
    const organization = await prisma.organization.upsert({
      where: { clerkOrgId }, // Use a unique field
      update: { name: formData.get("organizationName") as string },
      create: {
        name: formData.get("organizationName") as string,
        clerkOrgId,
      },
    });

    // Add user to organization
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER",
      },
    });

    // Mark onboarding as complete in Clerk & Prisma
    await client.users.updateUser(userId, {
      publicMetadata: { onboardingComplete: true },
    });

    await prisma.user.update({
      where: { clerkId: userId },
      data: { onboardingComplete: true },
    });

    return { message: "Onboarding completed successfully!" };
  } catch (err) {
    console.error("Onboarding error:", err);
    return { error: "Error during onboarding." };
  }
};
