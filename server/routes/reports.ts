import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import type { Context } from "../context";
import InternalProvider from "@/lib/reports/providers/internal";
import type { SprintSummaryConfig } from "@/lib/reports/types";
import { TRPCError } from "@trpc/server";

const ensureMember = async (ctx: Context, orgId: string) => {
  const member = await ctx.prisma.organizationMember.findFirst({
    where: {
      organization: { clerkOrgId: orgId },
      user: { clerkId: ctx.auth.userId ?? undefined },
    },
    select: { id: true },
  });
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
};

const defaultSprintConfig: SprintSummaryConfig = {
  sections: {
    overview: true,
    velocity: true,
    burndown: true,
    completed: true,
    inProgress: true,
    blockers: true,
    assignees: true,
  },
  riskThresholdPct: 60,
};

export const reportsRouter = router({
  // Templates
  listTemplates: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      const templates = await ctx.prisma.reportTemplate.findMany({
        where: { orgId: input.orgId, active: true },
        orderBy: { createdAt: "desc" },
      });
      // Ensure at least one default template
      if (templates.length === 0) {
        const t = await ctx.prisma.reportTemplate.create({
          data: {
            orgId: input.orgId,
            name: "Sprint Summary (default)",
            kind: "SPRINT_SUMMARY",
            description: "Overview, burndown, velocity, lists.",
            format: "HTML",
            config: defaultSprintConfig as any,
          },
        });
        return [t];
      }
      return templates;
    }),

  upsertTemplate: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        templateId: z.string().optional(),
        name: z.string().min(1),
        kind: z.enum(["SPRINT_SUMMARY"]),
        description: z.string().optional(),
        format: z.enum(["HTML", "PDF"]).default("HTML"),
        config: z.any(), // validated per-kind on client
        active: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      if (input.templateId) {
        return ctx.prisma.reportTemplate.update({
          where: { id: input.templateId },
          data: {
            name: input.name,
            kind: input.kind,
            description: input.description,
            format: input.format,
            config: input.config as any,
            active: input.active,
          },
        });
      }
      return ctx.prisma.reportTemplate.create({
        data: {
          orgId: input.orgId,
          name: input.name,
          kind: input.kind,
          description: input.description,
          format: input.format,
          config: input.config as any,
          active: input.active,
        },
      });
    }),

  // Runs
  getRun: protectedProcedure
    .input(z.object({ runId: z.string(), orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      const run = await ctx.prisma.reportRun.findUnique({
        where: { id: input.runId },
      });
      if (!run || run.orgId !== input.orgId)
        throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),

  listRuns: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.reportRun.findMany({
        where: { orgId: input.orgId, status: "READY" },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          sprintId: true,
          templateId: true,
          createdAt: true,
          pdfUrl: true,
        },
      });
    }),

  getSprintRun: protectedProcedure
    .input(z.object({ orgId: z.string(), sprintId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      return ctx.prisma.reportRun.findFirst({
        where: { orgId: input.orgId, sprintId: input.sprintId, status: "READY" },
        orderBy: { createdAt: "desc" },
      });
    }),

  generateSprintReport: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        sprintId: z.string(),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);

      const template = input.templateId
        ? await ctx.prisma.reportTemplate.findFirst({
            where: { id: input.templateId, orgId: input.orgId },
          })
        : await ctx.prisma.reportTemplate.findFirst({
            where: { orgId: input.orgId, kind: "SPRINT_SUMMARY", active: true },
          });

      if (!template)
        throw new TRPCError({ code: "NOT_FOUND", message: "No template found" });

      const run = await ctx.prisma.reportRun.create({
        data: {
          orgId: input.orgId,
          templateId: template.id,
          sprintId: input.sprintId,
          status: "GENERATING",
          format: template.format,
          startedAt: new Date(),
        },
      });

      try {
        const { html, data, pdfUrl } = await InternalProvider.generateSprintSummary(
          template.config as SprintSummaryConfig,
          { sprintId: input.sprintId },
          { orgId: input.orgId, prisma: ctx.prisma }
        );

        const updated = await ctx.prisma.reportRun.update({
          where: { id: run.id },
          data: {
            data: data as any, // ✅ ensure JSON compatibility
            html,
            pdfUrl: pdfUrl ?? null,
            status: "READY",
            finishedAt: new Date(),
          },
        });

        return updated;
      } catch (e: any) {
        await ctx.prisma.reportRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            error: String(e?.message ?? e),
            finishedAt: new Date(),
          },
        });
        throw e;
      }
    }),

  // Deliver via email
  deliverRunEmail: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        runId: z.string(),
        to: z.array(z.string().email()).min(1),
        subject: z.string().min(1).default("Sprint report"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMember(ctx, input.orgId);
      const run = await ctx.prisma.reportRun.findUnique({
        where: { id: input.runId },
      });
      if (!run || run.orgId !== input.orgId || run.status !== "READY")
        throw new TRPCError({ code: "NOT_FOUND" });

      const html = run.html ?? "<p>No content</p>";
      const deliveries = await Promise.all(
        input.to.map(async (addr) => {
          try {
            await sendEmail(addr, input.subject, html);
            return ctx.prisma.reportDelivery.create({
              data: {
                orgId: input.orgId, // ✅ required by schema
                runId: run.id,
                channel: "EMAIL",
                target: addr,
                status: "SENT",
                sentAt: new Date(),
              },
            });
          } catch (err: any) {
            return ctx.prisma.reportDelivery.create({
              data: {
                orgId: input.orgId, // ✅ required by schema
                runId: run.id,
                channel: "EMAIL",
                target: addr,
                status: "ERROR",
                error: String(err?.message ?? err),
              },
            });
          }
        })
      );

      return { ok: true, deliveries: deliveries.length };
    }),
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email:dev] →", to, subject);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "reports@yourapp.example",
    to,
    subject,
    html,
  });
}
