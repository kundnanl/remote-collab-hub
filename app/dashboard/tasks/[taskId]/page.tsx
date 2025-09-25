import TaskDetail from "@/components/tasks/TaskDetail";

export default function TaskPage({ params }: { params: { taskId: string } }) {
  return <TaskDetail taskId={params.taskId} standalone />;
}
