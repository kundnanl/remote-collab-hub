'use client'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to RemoteHub 👋</h1>
      <p className="text-muted-foreground">
        Your workspace is ready. Let’s build something great.
      </p>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow border">Widget 1</div>
        <div className="bg-white p-4 rounded-xl shadow border">Widget 2</div>
        <div className="bg-white p-4 rounded-xl shadow border">Widget 3</div>
      </div>
    </div>
  )
}
