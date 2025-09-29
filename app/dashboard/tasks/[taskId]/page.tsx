import { use } from "react";
import TaskDetail from "@/components/tasks/TaskDetail";

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  return <TaskDetail taskId={taskId} standalone />;
}
