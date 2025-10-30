// dashboard/layout.tsx
import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import ClientPresenceWrapper from "./presence-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboardingComplete: true },
  });

  if (!user?.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <ClientPresenceWrapper orgId={orgId}>
      <main className="min-h-screen bg-background text-foreground grainy">
        {/* Background gradients */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10rem] h-[32rem] bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-3xl dark:from-primary/20" />
        </div>

        {/* Content wrapper */}
        <div
          className={cn(
            "relative max-w-7xl mx-auto px-6 md:px-10 py-10",
            "flex flex-col gap-8 animate-in fade-in-50 duration-500"
          )}
        >
          {children}
        </div>
      </main>
    </ClientPresenceWrapper>
  );
}