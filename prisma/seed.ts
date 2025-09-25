// prisma/seed.ts
import { PrismaClient, TaskStatus } from "@prisma/client";
const prisma = new PrismaClient();

async function ensureDefaultBoardForOrg(orgId: string) {
  let board = await prisma.board.findFirst({ where: { orgId, name: "Default" } });
  if (!board) {
    board = await prisma.board.create({ data: { orgId, name: "Default" } });
  }
  const defaults: { title: string; status: TaskStatus; position: number }[] = [
    { title: "Backlog",      status: "BACKLOG",     position: 0 },
    { title: "To do",        status: "TODO",        position: 1 },
    { title: "In progress",  status: "IN_PROGRESS", position: 2 },
    { title: "Review",       status: "REVIEW",      position: 3 },
    { title: "Done",         status: "DONE",        position: 4 },
  ];
  for (const col of defaults) {
    const exists = await prisma.boardColumn.findFirst({
      where: { boardId: board.id, status: col.status },
    });
    if (!exists) {
      await prisma.boardColumn.create({
        data: {
          boardId: board.id,
          title: col.title,
          status: col.status,
          position: col.position,
        },
      });
    }
  }
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { clerkOrgId: true } });
  for (const o of orgs) {
    await ensureDefaultBoardForOrg(o.clerkOrgId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
