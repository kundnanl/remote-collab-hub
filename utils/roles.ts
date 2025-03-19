import { prisma } from "@/server/db";

export const checkUserRole = async (userId: string, requiredRole: "ADMIN" | "MEMBER") => {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { organizations: true },
  });

  if (!user) return false;

  return user.organizations.some((org) => org.role === requiredRole);
};
