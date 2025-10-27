import { PrismaClient, ReportTemplateKind, ReportFormat } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding default sprint templates for all orgs...");

  const orgs = await prisma.organization.findMany();

  for (const org of orgs) {
    const existing = await prisma.reportTemplate.findFirst({
      where: { orgId: org.clerkOrgId, kind: ReportTemplateKind.SPRINT_SUMMARY },
    });

    if (!existing) {
      await prisma.reportTemplate.create({
        data: {
          orgId: org.clerkOrgId,
          name: "Default Sprint Summary",
          kind: ReportTemplateKind.SPRINT_SUMMARY,
          description: "Generates a sprint summary with velocity, completion %, blockers, and participants.",
          format: ReportFormat.HTML,
          config: {
            sections: {
              overview: true,
              burndown: true,
              completed: true,
              inProgress: true,
              blockers: true,
              assignees: true,
            },
            riskThresholdPct: 60,
          },
        },
      });
      console.log(`✅ Seeded for org ${org.name} (${org.clerkOrgId})`);
    } else {
      console.log(`✅ Template already exists for ${org.name}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
