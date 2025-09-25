// components/tasks/SprintPanel.tsx
"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { SprintCreateDialog } from "@/components/tasks/SprintCreateDialog";

type Sprint = RouterOutputs["sprints"]["list"][number];

export function SprintPanel({
  orgId,
  initialSprints,
}: {
  orgId: string;
  initialSprints: Sprint[];
}) {
  const utils = trpc.useUtils();
  const { data: sprints = [], isLoading } = trpc.sprints.list.useQuery(
    { orgId },
    { initialData: initialSprints }
  );

  const start = trpc.sprints.start.useMutation({
    onMutate: async (vars) => {
      await utils.sprints.list.cancel({ orgId });
      const prev = utils.sprints.list.getData({ orgId });
      utils.sprints.list.setData({ orgId }, (old) =>
        old?.map((s) => (s.id === vars.sprintId ? { ...s, status: "ACTIVE" } : s)) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.sprints.list.setData({ orgId }, ctx.prev);
    },
  });

  const close = trpc.sprints.close.useMutation({
    onMutate: async (vars) => {
      await utils.sprints.list.cancel({ orgId });
      const prev = utils.sprints.list.getData({ orgId });
      utils.sprints.list.setData({ orgId }, (old) =>
        old?.map((s) => (s.id === vars.sprintId ? { ...s, status: "CLOSED" } : s)) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.sprints.list.setData({ orgId }, ctx.prev);
    },
  });

  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sprints</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Sprint
        </Button>
      </div>

      <SprintCreateDialog orgId={orgId} open={open} setOpen={setOpen} />

      {isLoading && <div className="text-muted-foreground">Loading…</div>}

      <div className="space-y-3">
        {sprints.map((s) => (
          <Card key={s.id} className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted-foreground">
                {s.goal ?? "— no goal"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  s.status === "ACTIVE"
                    ? "default"
                    : s.status === "CLOSED"
                    ? "secondary"
                    : "outline"
                }
              >
                {s.status.toLowerCase()}
              </Badge>

              {s.status === "PLANNED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => start.mutate({ sprintId: s.id, orgId })}
                >
                  Start
                </Button>
              )}

              {s.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => close.mutate({ sprintId: s.id, orgId })}
                >
                  Close
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Separator />
    </div>
  );
}
