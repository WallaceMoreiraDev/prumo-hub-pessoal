import { Skeleton } from '@/components/ui/skeleton';

export function ModuleRouteSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-8 w-56 max-w-full rounded-xl" />
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0 rounded-xl" />
      </div>

      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-52 max-w-full rounded-lg" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-lg" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoginRouteSkeleton() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4"
      aria-busy="true"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-32 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function SimuladoExecucaoRouteSkeleton() {
  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground"
      aria-busy="true"
    >
      <header className="border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-md sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 lg:flex lg:items-center lg:justify-between lg:gap-4">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 lg:order-1 lg:flex-1 lg:gap-3">
            <Skeleton className="h-9 w-10 shrink-0 rounded-xl sm:w-24" />
            <Skeleton className="h-5 w-48 max-w-full flex-1 lg:flex-none" />
          </div>
          <Skeleton className="col-start-2 row-start-1 h-9 w-9 shrink-0 justify-self-end rounded-xl lg:order-2" />
          <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-between gap-2 lg:order-3 lg:w-auto lg:shrink-0 lg:flex-nowrap lg:justify-end">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12">
        <Skeleton className="h-[65vh] rounded-2xl lg:col-span-7 lg:h-full xl:col-span-8" />
        <Skeleton className="h-[50vh] rounded-2xl lg:col-span-5 lg:h-full xl:col-span-4" />
      </div>
    </div>
  );
}
