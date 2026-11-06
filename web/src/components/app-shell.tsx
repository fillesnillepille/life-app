import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { AiButton } from "@/components/ai-button";
import { signOut } from "@/lib/auth";
import {
  allSections,
  bottomBarSections,
  moreSectionIds,
  sectionIdFromPath,
} from "@/lib/sections";
import { cn } from "@/lib/utils";
import {
  usePocketBaseStatus,
  type PocketBaseStatus,
} from "@/lib/use-pocketbase-status";

// Tabs per row in the bottom bar. The grid has as many rows as it needs.
const BAR_COLUMNS = 4;

export function AppShell({ children }: { children: ReactNode }) {
  const { status, retry } = usePocketBaseStatus();
  const { pathname } = useLocation();
  const section = sectionIdFromPath(pathname);
  // "Mer" also counts as active on the sections it leads to.
  const activeIndex = bottomBarSections.findIndex((item) =>
    item.id === "more"
      ? section !== undefined && moreSectionIds.includes(section)
      : section === item.id,
  );
  const activeRow = Math.max(Math.floor(activeIndex / BAR_COLUMNS), 0);
  const activeColumn = Math.max(activeIndex, 0) % BAR_COLUMNS;
  const barRowCount = Math.ceil(bottomBarSections.length / BAR_COLUMNS);

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[13rem_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-sidebar lg:flex">
        <p className="border-b px-4 py-4 text-sm font-semibold tracking-widest">
          Filip
        </p>
        <nav aria-label="Sektioner" className="flex-1 p-2">
          {allSections.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  isActive &&
                    "border-primary bg-sidebar-accent text-foreground",
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
          <AiButton variant="side" />
        </nav>
        <div className="space-y-3 border-t p-4">
          <ConnectionStatus status={status} onRetry={retry} />
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden />
            Logga ut
          </button>
        </div>
      </aside>

      <div className="min-w-0 pb-36 lg:pb-0">
        <header className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <p className="text-sm font-semibold tracking-widest">Filip</p>
          <ConnectionStatus status={status} onRetry={retry} />
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 lg:p-6">{children}</main>
      </div>

      <nav
        aria-label="Sektioner"
        className="fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-1 border-t bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {/* A fixed grid, so every column lines up across the rows. One pill
            slides behind the selected tab's icon, and moves between rows too. */}
        <div className="relative grid flex-1 grid-cols-4">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-0 top-0 p-1 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
              activeIndex < 0 && "opacity-0",
            )}
            style={{
              width: `${100 / BAR_COLUMNS}%`,
              height: `${100 / barRowCount}%`,
              transform: `translate(${activeColumn * 100}%, ${activeRow * 100}%)`,
            }}
          >
            <span className="block size-full rounded-lg bg-primary/10" />
          </span>
          {bottomBarSections.map((item, index) => {
            const active = index === activeIndex;
            return (
              <Link
                key={item.id}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[3.75rem] flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors duration-300 motion-reduce:transition-none",
                  active && "text-primary",
                )}
              >
                {/* Fixed-height slot, so the bigger selected icon moves nothing. */}
                <span className="grid h-7 place-items-center">
                  <item.icon
                    className={cn(
                      "transition-[width,height] duration-300 ease-out motion-reduce:transition-none",
                      active ? "size-6" : "size-5",
                    )}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    "text-[0.6875rem] leading-4",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        {/* A tab on the bar's right end: it rises above the bar and covers the
            bar's top border. Outlined on top and left only, so it runs off the
            right and bottom edges of the screen. Tap to open the chat, hold to
            speak. */}
        <AiButton variant="tab" />
      </nav>
    </div>
  );
}

function ConnectionStatus({
  status,
  onRetry,
}: {
  status: PocketBaseStatus;
  onRetry: () => void;
}) {
  if (status === "unreachable") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 text-xs text-destructive underline-offset-4 hover:underline"
      >
        <span className="size-2 bg-destructive" aria-hidden />
        DB offline, försök igen
      </button>
    );
  }

  return (
    <p
      className="flex items-center gap-2 text-xs text-muted-foreground"
      role="status"
    >
      <span
        className={cn(
          "size-2 bg-emerald-400",
          status === "checking" && "animate-pulse bg-muted-foreground",
        )}
        aria-hidden
      />
      {status === "checking" ? "DB kontrolleras" : "DB online"}
    </p>
  );
}
