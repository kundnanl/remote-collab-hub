import type { PrismaClient } from "@prisma/client";

export type SprintSummaryConfig = {
  sections: {
    overview: boolean;
    velocity: boolean;
    burndown: boolean;
    completed: boolean;
    inProgress: boolean;
    blockers: boolean;
    assignees: boolean;
  };
  // When to flag “at-risk” sprints
  riskThresholdPct?: number; // e.g. < 60% done -> "at-risk"
};

export type ReportContext = {
  orgId: string;
  prisma: PrismaClient;
};

export type SprintSummaryParams = {
  sprintId: string;
};

export type GeneratedReport = {
  data: unknown;     // JSON metrics payload (typed where used)
  html: string;      // full HTML to render/email
  pdfUrl?: string;   // optional
};

export interface ReportProvider {
  generateSprintSummary(
    cfg: SprintSummaryConfig,
    params: SprintSummaryParams,
    ctx: ReportContext
  ): Promise<GeneratedReport>;
}
