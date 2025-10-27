import { format } from "date-fns";
import type {
    ReportProvider,
    SprintSummaryConfig,
    SprintSummaryParams,
    ReportContext,
    GeneratedReport,
} from "../types";
import type { Task, TaskActivity, TaskStatus, TaskPriority, TaskType } from "@prisma/client";

// Which statuses count as “in progress” (for cycle-time) and which is “done”
const IN_PROGRESS_SET: TaskStatus[] = ["IN_PROGRESS", "REVIEW"];
const DONE_STATUS: TaskStatus = "DONE";

type StatusChangeMeta = { from?: TaskStatus; to?: TaskStatus } | null;
type SprintTaskLite = {
    id: string;
    orgId: string;
    title: string;
    estimate: number | null;
    assigneeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    column: { status: TaskStatus } | null;
    type: TaskType;
    priority: TaskPriority;
};

type SlimTask = Pick<
    Task,
    "id" | "title" | "estimate" | "priority" | "type" | "assigneeId" | "updatedAt"
>;

type BurndownPoint = { day: string; remaining: number };
type ThroughputPoint = { day: string; points: number };
type AssigneeStats = { name: string; email: string; pointsDone: number; tasksDone: number };

const InternalProvider: ReportProvider = {
    async generateSprintSummary(
        cfg: SprintSummaryConfig,
        params: SprintSummaryParams,
        ctx: ReportContext
    ) {
        const { orgId, prisma } = ctx;

        const sprint = await prisma.sprint.findUnique({
            where: { id: params.sprintId },
            include: {
                tasks: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        title: true,
                        estimate: true,
                        assigneeId: true,
                        createdAt: true,
                        updatedAt: true,
                        orgId: true,
                        column: { select: { status: true } },
                        type: true,
                        priority: true,
                    },
                },
            },
        });

        if (!sprint || sprint.orgId !== orgId)
            throw new Error("Sprint not found or not in org");

        // Activities for status transitions (to compute startedAt, doneAt, reopen etc.)
        const taskIds = sprint.tasks.map((t) => t.id);
        const activities = taskIds.length
            ? await prisma.taskActivity.findMany({
                where: { orgId, taskId: { in: taskIds }, type: "STATUS_CHANGED" },
                orderBy: { createdAt: "asc" },
                select: { taskId: true, createdAt: true, meta: true },
            })
            : [];

        const mapActivities = new Map<string, TaskActivity[]>();
        for (const a of activities as TaskActivity[]) {
            const arr = mapActivities.get(a.taskId) ?? [];
            arr.push(a);
            mapActivities.set(a.taskId, arr);
        }

        type Timeline = { startedAt?: Date; doneAt?: Date; reopened?: boolean };
        const timelines = new Map<string, Timeline>();

        const getTimeline = (taskId: string): Timeline => {
            if (timelines.has(taskId)) return timelines.get(taskId)!;
            const arr = (mapActivities.get(taskId) ?? []).sort(
                (a, b) => +a.createdAt - +b.createdAt
            );
            const tl: Timeline = {};
            let everDone = false;

            for (const ev of arr) {
                const meta = (ev.meta as StatusChangeMeta) ?? {};
                if (!tl.startedAt && meta.to && IN_PROGRESS_SET.includes(meta.to))
                    tl.startedAt = ev.createdAt;
                if (!tl.doneAt && meta.to === DONE_STATUS) {
                    tl.doneAt = ev.createdAt;
                    everDone = true;
                }
                if (everDone && meta.to && meta.to !== DONE_STATUS) tl.reopened = true;
            }
            timelines.set(taskId, tl);
            return tl;
        };

        // Time window
        const start = sprint.startDate ?? sprint.tasks[0]?.createdAt ?? new Date();
        const end = sprint.endDate ?? new Date();
        const days =
            Math.max(1, Math.ceil((+end - +start) / (24 * 3600 * 1000))) + 1;

        // Derived sets
        const nowStatus = (t: SprintTaskLite) => t.column?.status ?? "TODO";

        const completed = sprint.tasks.filter((t) => {
            const tl = getTimeline(t.id);
            return !!tl.doneAt || nowStatus(t) === DONE_STATUS;
        });

        const inProgress = sprint.tasks.filter((t) => {
            const status = nowStatus(t);
            return status !== DONE_STATUS && t.column !== null;
        });

        const scopedIn = sprint.tasks.filter(
            (t) => t.createdAt >= start && t.createdAt <= end
        );

        const notDone = sprint.tasks.filter((t) => {
            const tl = getTimeline(t.id);
            return !(tl.doneAt && tl.doneAt <= end) && nowStatus(t) !== DONE_STATUS;
        });

        // Metrics
        const pts = (t: { estimate: number | null }) => t.estimate ?? 1;
        const velocity = completed.reduce((acc, t) => acc + pts(t), 0);
        const totalPts = sprint.tasks.reduce((acc, t) => acc + pts(t), 0);
        const completionPct = totalPts
            ? Math.round((velocity / totalPts) * 100)
            : 0;
        const reopenCount = sprint.tasks.reduce(
            (acc, t) => (getTimeline(t.id).reopened ? acc + 1 : acc),
            0
        );

        const daysArr = Array.from(
            { length: days },
            (_, i) => new Date(+start + i * 24 * 3600 * 1000)
        );

        const doneByDay = daysArr.map((d) => {
            const next = new Date(+d + 24 * 3600 * 1000);
            const ptsDone = completed
                .filter((t) => {
                    const tl = getTimeline(t.id);
                    const when = tl.doneAt ?? end;
                    return when >= d && when < next;
                })
                .reduce((acc, t) => acc + pts(t), 0);
            return { day: d, points: ptsDone };
        });

        const burndown = daysArr.map((d) => {
            const remaining = sprint.tasks.reduce((acc, t) => {
                const tl = getTimeline(t.id);
                const doneAt = tl.doneAt;
                if (
                    doneAt &&
                    doneAt <= new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
                ) {
                    return acc;
                }
                return acc + pts(t);
            }, 0);
            return { day: d, remaining };
        });

        // Assignee breakdown
        const byAssignee = new Map<string, AssigneeStats>();
        if (completed.length) {
            const assignees = await prisma.user.findMany({
                where: {
                    clerkId: {
                        in: Array.from(
                            new Set(
                                completed.map((t) => t.assigneeId).filter(Boolean) as string[]
                            )
                        ),
                    },
                },
                select: { clerkId: true, name: true, email: true },
            });
            const idx = new Map(assignees.map((a) => [a.clerkId, a]));
            for (const t of completed) {
                const id = t.assigneeId ?? "unassigned";
                const meta =
                    byAssignee.get(id) ??
                    {
                        name:
                            id === "unassigned"
                                ? "Unassigned"
                                : idx.get(id)?.name ?? idx.get(id)?.email ?? "Unknown",
                        email: idx.get(id)?.email ?? "",
                        pointsDone: 0,
                        tasksDone: 0,
                    };
                meta.pointsDone += pts(t);
                meta.tasksDone += 1;
                byAssignee.set(id, meta);
            }
        }

        const data = {
            sprint: {
                id: sprint.id,
                name: sprint.name,
                goal: sprint.goal,
                status: sprint.status,
                startDate: sprint.startDate,
                endDate: sprint.endDate,
                days,
            },
            metrics: {
                tasksTotal: sprint.tasks.length,
                pointsTotal: totalPts,
                pointsDone: velocity,
                completionPct,
                scopedIn: scopedIn.length,
                carriedOver: notDone.length,
                reopened: reopenCount,
                throughput: doneByDay.map((d) => ({
                    day: format(d.day, "MMM d"),
                    points: d.points,
                })),
            },
            lists: {
                completed: completed.map(pickTaskSlim),
                inProgress: inProgress.map(pickTaskSlim),
                notDone: notDone.map(pickTaskSlim),
            },
            burndown: burndown.map((b) => ({
                day: format(b.day, "MMM d"),
                remaining: b.remaining,
            })),
            byAssignee: Array.from(byAssignee.values()),
        };

        const html = renderHtml(cfg, data);
        const out: GeneratedReport = { data, html };
        return out;
    },
};

export default InternalProvider;

/* ---------- helpers ---------- */

function pickTaskSlim(t: SlimTask) {
    return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        type: t.type,
        estimate: t.estimate,
        assigneeId: t.assigneeId,
        updatedAt: t.updatedAt,
    };
}

function renderHtml(
    cfg: SprintSummaryConfig,
    data: {
        sprint: {
            id: string;
            name: string;
            goal: string | null;
            status: string;
            startDate: Date | null;
            endDate: Date | null;
        };
        metrics: {
            tasksTotal: number;
            pointsTotal: number;
            pointsDone: number;
            completionPct: number;
            scopedIn: number;
            carriedOver: number;
            reopened: number;
            throughput: ThroughputPoint[];
        };
        lists: {
            completed: SlimTask[];
            inProgress: SlimTask[];
            notDone: SlimTask[];
        };
        burndown: BurndownPoint[];
        byAssignee: AssigneeStats[];
    }
) {
    const s = data.sprint;
    const m = data.metrics;
    const burndown = data.burndown;
    const completed = data.lists.completed;
    const inProgress = data.lists.inProgress;
    const notDone = data.lists.notDone;
    const byAssignee = data.byAssignee;


    const colorForPct = (pct: number) => (pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(s.name)} — Sprint report</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root{
  --bg:#f6f7fb; --fg:#0f172a; --muted:#5b6477; --card:#ffffff; --line:#e6e8ef;
  --good:#16a34a; --warn:#d97706; --bad:#ef4444; --chip:#eef1f7;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:28px}
h1{margin:0 0 6px;font-size:28px}
.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.header{padding:18px 20px;margin-bottom:14px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
.metric{padding:14px 16px}
.metric .label{font-size:12px;color:var(--muted)}
.metric .value{font-size:28px;font-weight:700;margin-top:2px}
.metric .sub{font-size:12px;color:var(--muted)}
.good .value{color:var(--good)} .warn .value{color:var(--warn)} .bad .value{color:var(--bad)}
.section{padding:16px 18px;margin-bottom:12px}
.section h2{margin:0 0 10px;font-size:16px}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left}
.chip{display:inline-block;background:var(--chip);border:1px solid var(--line);border-radius:999px;font-size:12px;padding:2px 8px;margin-left:6px}
.flex{display:flex;gap:12px;align-items:center}
.lists{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
.list ul{padding-left:16px;margin:8px 0 0}
.footer{margin-top:20px;color:var(--muted);font-size:12px;text-align:center}
svg{display:block;width:100%;height:120px}
@media (max-width:900px){ .grid{grid-template-columns:1fr 1fr} .lists{grid-template-columns:1fr} }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card header">
      <h1>🚀 ${escapeHtml(s.name)} — Sprint summary</h1>
      <div class="muted">Status: <span class="chip">${s.status.toLowerCase()}</span>
        ${s.startDate ? ` · ${format(new Date(s.startDate), "MMM d")} → ${s.endDate ? format(new Date(s.endDate), "MMM d") : "—"}` : ""}</div>
      ${s.goal ? `<div class="muted" style="margin-top:6px">${escapeHtml(s.goal)}</div>` : ""}
    </div>

    <div class="grid">
      <div class="card metric ${colorForPct(m.completionPct)}">
        <div class="label">Completion</div>
        <div class="value">${m.completionPct}%</div>
        <div class="sub">${m.pointsDone}/${m.pointsTotal} pts</div>
      </div>
      <div class="card metric">
        <div class="label">Velocity</div>
        <div class="value">${m.pointsDone} pts</div>
        <div class="sub">Throughput last day: ${m.throughput.at(-1)?.points ?? 0} pts</div>
      </div>
      <div class="card metric">
        <div class="label">Scope & Quality</div>
        <div class="value">${m.scopedIn} <span class="sub">added</span></div>
        <div class="sub">${m.carriedOver} carried · ${m.reopened} reopened</div>
      </div>
    </div>

    <div class="card section">
      <h2>Burndown (points remaining)</h2>
      ${svgBurndown(burndown)}
      <table class="table">
        <thead><tr><th>Day</th><th>Remaining</th></tr></thead>
        <tbody>${burndown.map(b => `<tr><td class="muted">${b.day}</td><td>${b.remaining}</td></tr>`).join("")}</tbody>
      </table>
    </div>

    <div class="lists">
      <div class="card section list">
        <h2>✅ Completed</h2>
        ${taskList(completed)}
      </div>
      <div class="card section list">
        <h2>🚧 In progress</h2>
        ${taskList(inProgress)}
      </div>
      <div class="card section list">
        <h2>⛔ Not finished</h2>
        ${taskList(notDone)}
      </div>
    </div>

    <div class="card section">
      <h2>By assignee</h2>
      <table class="table">
        <thead><tr><th>Member</th><th>Tasks</th><th>Points</th></tr></thead>
        <tbody>
          ${byAssignee.map(a => `
            <tr>
              <td>${escapeHtml(a.name)}</td>
              <td>${a.tasksDone}</td>
              <td>${a.pointsDone}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by <strong>RemoteHub</strong> · ${format(new Date(), "EEE, d MMM yyyy HH:mm:ss 'GMT'")}
    </div>
  </div>
</body>
</html>`;
}

/* ---------- utilities ---------- */

function escapeHtml(str?: string | null) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function taskList(list: Array<{ id: string; title: string; type: string; priority: string }>) {
    if (!list.length) {
        return `<div class="muted">No items.</div>`;
    }
    return `
    <ul>
      ${list.map(
        (t) => `
        <li>
          ${escapeHtml(t.title)}
          <span class="chip">${t.type.toLowerCase()}</span>
          <span class="chip">${t.priority.toLowerCase()}</span>
        </li>`
    ).join("")}
    </ul>`;
}

function svgBurndown(points: Array<{ day: string; remaining: number }>) {
    if (!points.length) return "";

    const max = Math.max(...points.map((p) => p.remaining)) || 1;
    const stepX = 100 / (points.length - 1 || 1);
    const pts = points
        .map((p, i) => {
            const x = (i * stepX).toFixed(2);
            const y = (100 - (p.remaining / max) * 100).toFixed(2);
            return `${x},${y}`;
        })
        .join(" ");

    return `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--good)"
        stroke-width="2"
        points="${pts}"
        vector-effect="non-scaling-stroke"
      />
      <line x1="0" y1="100" x2="100" y2="0" stroke="var(--line)" stroke-dasharray="2,2" />
    </svg>`;
}
