"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useOrgPresence } from "@/components/presence/PresenceProvider";
import { usePresencePage } from "@/components/presence/usePresencePage";
import { trpc } from "@/server/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
    Rocket,
    FileText,
    Video,
    CalendarDays,
    ListChecks,
    ListTodo,
    AlertTriangle,
    Users,
    ChevronRight,
    Timer,
    ClipboardList,
    ArrowRight,
    LayoutDashboard,
    Loader2,
} from "lucide-react";

import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import type { RouterOutputs } from "@/server/client";

type Task = RouterOutputs["tasks"]["list"][number];

export default function DashboardHome({
    orgId,
    overdue,
    dueToday,
    upcoming,
    inProgress,
}: {
    orgId: string;
    overdue: Task[];
    dueToday: Task[];
    upcoming: Task[];
    inProgress: Task[];
}) {
    // Mark this page in presence
    usePresencePage("dashboard");

    const { user, isLoaded: userLoaded } = useUser();
    const { organization, isLoaded: orgLoaded } = useOrganization();

    const loadingTop = !userLoaded || !orgLoaded;
    const greeting = React.useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    type DocsQueryResult = {
        isLoading: boolean;
        data?: { docs: Array<{ id: string; title: string; updatedAt?: string }> };
    };

    const docsQ: DocsQueryResult = trpc.docs?.recent?.useQuery
        ? trpc.docs.recent.useQuery(
            { orgId, limit: 8 },
            { refetchOnWindowFocus: false }
        )
        : { isLoading: false, data: { docs: [] } };

    return (
        <section className="relative isolate w-full">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent dark:from-primary/20 blur-2xl" />

            {/* HEADER */}
            <div className="mx-auto max-w-7xl px-6 md:px-10 pt-10 pb-4">
                {loadingTop ? (
                    <div className="space-y-4">
                        <Skeleton className="h-11 w-2/3" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                ) : (
                    <>
                        <motion.h1
                            className="text-3xl md:text-5xl font-bold tracking-tight leading-snug"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45 }}
                        >
                            {greeting}, {user?.firstName ?? "there"} 👋
                        </motion.h1>
                        <p className="text-muted-foreground mt-2">
                            Welcome back to <strong>{organization?.name ?? "RemoteHub"}</strong>. Here’s your day at a glance.
                        </p>
                    </>
                )}

                {/* Presence strip */}
                <div className="mt-5">
                    <PresenceStrip />
                </div>

                {/* Quick actions with click loading */}
                <div className="mt-8 flex flex-wrap gap-3">
                    <NewTaskDialog orgId={orgId} defaultSprintId={null} />

                    <NavButton href="/dashboard/office" icon={<Video className="h-4 w-4" />}>
                        Join Office
                    </NavButton>

                    <NavButton href="/dashboard/office" variant="secondary" icon={<Rocket className="h-4 w-4" />}>
                        Whiteboard
                    </NavButton>

                    <NavButton href="/dashboard/docs" variant="outline" icon={<FileText className="h-4 w-4" />}>
                        New Doc
                    </NavButton>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className="mx-auto max-w-7xl px-6 md:px-10 pb-16">
                <div className="grid grid-cols-12 gap-6">
                    {/* LEFT */}
                    <div className="col-span-12 lg:col-span-8 space-y-6">
                        <SectionHeader icon={LayoutDashboard} title="My day" subtitle="What needs your attention right now." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <TaskBucket title="Overdue" icon={AlertTriangle} color="text-red-600" tasks={overdue} empty="You’re all caught up. 🎉" />
                            <TaskBucket title="Due today" icon={CalendarDays} color="text-amber-600" tasks={dueToday} empty="Nothing due today." />
                            <TaskBucket title="Upcoming (7 days)" icon={ListTodo} color="text-blue-600" tasks={upcoming} empty="No upcoming deadlines." />
                            <TaskBucket title="In progress" icon={ListChecks} color="text-emerald-600" tasks={inProgress} empty="Pick something from the backlog to get rolling." />
                        </div>

                        <DocsBlock loading={!!docsQ.isLoading} docs={docsQ.data?.docs ?? []} />
                    </div>

                    {/* RIGHT */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <SectionHeader icon={Users} title="Team now" subtitle="Live presence across the org." />
                        <ActiveRooms />
                        <FocusCard />
                        <StandupCard />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ───────────────────────── Widgets ───────────────────────── */

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
}: {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="flex items-start gap-2">
            <div className="rounded-md border bg-card p-2">
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <div className="text-lg font-semibold leading-6">{title}</div>
                {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
            </div>
        </div>
    );
}

/* Presence strip with true loading + “Name — Location” */
function PresenceStrip() {
    const { ready, orgMembers } = useOrgPresence();

    // Loading state
    if (!ready) {
        return (
            <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-sm">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-4 w-16 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    // Empty state (only after ready)
    if (ready && orgMembers.length === 0) {
        return (
            <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking for who’s online…
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {orgMembers.map((m) => {
                const location = m.roomId ? `Office: ${m.roomId}` : (m.page ? titleCase(m.page) : "—");
                return (
                    <div
                        key={`${m.userId}:${m.ref}`}
                        className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-sm"
                        title={location}
                    >
                        <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: m.status === "online" ? "#22c55e" : "#94a3b8" }}
                        />
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={m.imageUrl ?? undefined} />
                                <AvatarFallback>{m.name?.charAt(0) ?? "U"}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm whitespace-nowrap">{m.name ?? "User"}</span>
                            <Badge variant="outline" className="text-[11px]">{location}</Badge>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ActiveRooms() {
    const { ready, orgMembers, liveSince } = useOrgPresence();

    const groups = React.useMemo(() => {
        const map = new Map<string, { members: typeof orgMembers }>();
        for (const m of orgMembers) {
            if (!m.roomId) continue;
            type RoomGroup = { members: typeof orgMembers };
            const map = new Map<string, RoomGroup>();
            for (const m of orgMembers) {
                if (!m.roomId) continue;
                if (!map.has(m.roomId)) map.set(m.roomId, { members: [] });
                map.get(m.roomId)!.members.push(m);
            }
            map.get(m.roomId)!.members.push(m);
        }
        return Array.from(map.entries()).map(([id, v]) => ({ roomId: id, ...v }));
    }, [orgMembers]);

    // ⛓ now only branch during render
    if (!ready) {
        return (
            <Card className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <div className="font-medium">Active rooms</div>
                </div>
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-md border bg-card p-3"
                        >
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-28" />
                                <div className="flex -ml-1 items-center">
                                    {Array.from({ length: 4 }).map((__, j) => (
                                        <Skeleton key={j} className="-ml-1 h-6 w-6 rounded-full" />
                                    ))}
                                </div>
                            </div>
                            <Skeleton className="h-8 w-20 rounded" />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    if (groups.length === 0) {
        return (
            <Card className="rounded-xl border p-4">
                <div className="mb-2 flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <div className="font-medium">Active rooms</div>
                </div>
                <div className="text-sm text-muted-foreground">
                    No active rooms right now.
                </div>
            </Card>
        );
    }

    return (
        <Card className="rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2">
                <Video className="h-4 w-4" />
                <div className="font-medium">Active rooms</div>
            </div>

            <div className="space-y-3">
                {groups.map((g) => {
                    const since = liveSince(g.roomId);
                    return (
                        <div
                            key={g.roomId}
                            className="flex items-center justify-between rounded-md border bg-card p-3"
                        >
                            <div>
                                <div className="font-medium">{g.roomId}</div>
                                <div className="text-xs text-muted-foreground">
                                    {g.members.length} online
                                    {since ? ` · live since ${since.toLocaleTimeString()}` : ""}
                                </div>
                                <div className="mt-2 -ml-1 flex items-center">
                                    {g.members.slice(0, 6).map((m) => (
                                        <Avatar
                                            key={m.userId}
                                            className="-ml-1 h-6 w-6 ring-2 ring-background"
                                        >
                                            <AvatarImage src={m.imageUrl ?? undefined} />
                                            <AvatarFallback>{m.name?.charAt(0) ?? "U"}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                </div>
                            </div>
                            <NavButton
                                href={`/dashboard/office/room/${g.roomId}`}
                                size="sm"
                                icon={<Video className="h-4 w-4" />}
                            >
                                Join
                            </NavButton>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

/* Task bucket card */
function TaskBucket({
    title,
    icon: Icon,
    color,
    tasks,
    empty,
}: {
    title: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    color: string;
    tasks: Task[];
    empty: string;
}) {
    return (
        <Card className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <div className="font-medium">{title}</div>
                </div>
                <Badge variant="outline">{tasks.length}</Badge>
            </div>
            <div className="space-y-2">
                <AnimatePresence initial={false}>
                    {tasks.slice(0, 6).map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="group flex cursor-pointer items-center justify-between rounded-md border bg-card px-3 py-2 hover:bg-accent/50"
                        >
                            <div className="min-w-0">
                                <Link href={`/dashboard/tasks/${t.id}`} className="truncate font-medium hover:underline" title={t.title}>
                                    {t.title}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                    {t.priority.toLowerCase()} · {t.type.toLowerCase()}
                                </div>
                            </div>
                            <Link href={`/dashboard/tasks/${t.id}`}>
                                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition">
                                    Open <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </Link>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {tasks.length === 0 && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{empty}</div>
                )}
            </div>
            {tasks.length > 6 && (
                <div className="mt-3">
                    <Link href="/dashboard/tasks?tab=backlog">
                        <Button variant="link" className="px-0">See all <ArrowRight className="ml-1 h-4 w-4" /></Button>
                    </Link>
                </div>
            )}
        </Card>
    );
}

/* Focus + Standup remain the same, minor polish */
function FocusCard() {
    const [running, setRunning] = React.useState(false);
    const [seconds, setSeconds] = React.useState(0);

    React.useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [running]);

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return (
        <Card className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    <div className="font-medium">Focus session</div>
                </div>
                <Badge variant="outline">{running ? "running" : "idle"}</Badge>
            </div>

            <div className="text-3xl font-semibold tabular-nums">
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => setRunning((r) => !r)}>
                    {running ? "Pause" : "Start"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setRunning(false); setSeconds(0); }}>
                    Reset
                </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
                Pick one task from “My day”, run a 25-minute focus sprint.
            </div>
        </Card>
    );
}

function StandupCard() {
    const [text, setText] = React.useState("");
    const [saved, setSaved] = React.useState(false);

    return (
        <Card className="rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <div className="font-medium">Daily standup</div>
            </div>
            <textarea
                value={text}
                onChange={(e) => { setText(e.currentTarget.value); setSaved(false); }}
                placeholder="Yesterday I…, Today I’ll…, Blockers…"
                className="mt-1 h-28 w-full resize-none rounded-md border bg-background p-2 text-sm outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={() => setSaved(true)}>Save locally</Button>
                <Link href={`/dashboard/docs/new?template=standup&prefill=${encodeURIComponent(text)}`}>
                    <Button size="sm" variant="secondary">Create standup doc</Button>
                </Link>
                {saved && <Badge variant="outline">Saved</Badge>}
            </div>
        </Card>
    );
}

/* Docs (optional) */
function DocsBlock({ loading, docs }: { loading: boolean; docs: Array<{ id: string; title: string; updatedAt?: string }> }) {
    return (
        <Card className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div className="font-medium">Recent docs</div>
                </div>
                <Link href="/dashboard/docs"><Button size="sm" variant="ghost">All docs</Button></Link>
            </div>
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
                </div>
            ) : docs?.length ? (
                <div className="space-y-2">
                    {docs.slice(0, 6).map((d) => (
                        <Link key={d.id} href={`/dashboard/docs/${d.id}`}>
                            <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 hover:bg-accent/50">
                                <div className="truncate">{d.title}</div>
                                <div className="text-xs text-muted-foreground">{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : ""}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    No recent docs.
                </div>
            )}
        </Card>
    );
}

/* Small nav button with click spinner */
function NavButton({
    href,
    icon,
    children,
    variant,
    size,
}: {
    href: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    variant?: React.ComponentProps<typeof Button>["variant"];
    size?: React.ComponentProps<typeof Button>["size"];
}) {
    const router = useRouter();
    const [busy, setBusy] = React.useState(false);
    return (
        <Button
            variant={variant}
            size={size}
            disabled={busy}
            onClick={() => { setBusy(true); router.push(href); }}
            className="gap-2"
        >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {children}
        </Button>
    );
}

/* utils */
function titleCase(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
