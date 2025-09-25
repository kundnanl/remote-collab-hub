import { supabase } from "@/lib/supabaseClient";
import type { RouterOutputs } from "@/server/client";
type Task = RouterOutputs["tasks"]["list"][number];

export function subscribeTasks(
  orgId: string,
  onInsert: (t: Task) => void,
  onUpdate: (t: Task) => void,
  onDelete: (t: Task) => void
) {
  const channel = supabase
    .channel(`public:Task:${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "Task", filter: `orgId=eq.${orgId}` },
      (payload) => {
        if (payload.eventType === "INSERT") onInsert(payload.new as Task);
        if (payload.eventType === "UPDATE") onUpdate(payload.new as Task);
        if (payload.eventType === "DELETE") onDelete(payload.old as Task);
      }
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
