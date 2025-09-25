import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Replace with your orgId from Clerk or an existing organization in DB
  const orgId = "cmfewxs700001l204zcgpytq9";

  // Create Virtual Office for org if not exists
  const office = await prisma.virtualOffice.upsert({
    where: { organizationId: orgId },
    update: {},
    create: {
      organizationId: orgId,
      rooms: {
        create: [
          { name: "Engineering Room", description: "Discuss code, bugs, and features" },
          { name: "Design Room", description: "Brainstorm UI/UX and product ideas" },
          { name: "Daily Standup", description: "Quick daily check-in" },
        ],
      },
    },
  });

  console.log("Seeded office:", office.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
