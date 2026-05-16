import { createFileRoute } from "@tanstack/react-router"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <p className="text-muted-foreground text-sm">Web Start</p>
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          TanStack Start is now using the installed app shell block for the
          primary layout.
        </p>
      </div>
      <DashboardSkeleton />
    </section>
  )
}
