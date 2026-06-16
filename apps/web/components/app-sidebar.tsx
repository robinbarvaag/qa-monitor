"use client";

import { Activity, LayoutGrid, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  {
    label: "Prosjekter",
    href: "/",
    icon: LayoutGrid,
    match: (p) => p === "/" || p.startsWith("/p/"),
  },
  { label: "Kjøringer", href: "#", icon: Activity, disabled: true },
  { label: "Funn", href: "#", icon: ShieldAlert, disabled: true },
  { label: "Innstillinger", href: "#", icon: Settings, disabled: true },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="grid size-7 place-content-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-4" />
        </div>
        <span className="font-heading text-sm font-semibold">qa-monitor</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => {
          const active = item.match?.(pathname) ?? pathname === item.href;
          const Icon = item.icon;
          const className =
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors";
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className={`${className} cursor-default text-muted-foreground/50`}
                title="Kommer senere"
              >
                <Icon className="size-4" />
                {item.label}
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${className} ${
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="size-7 shrink-0 rounded-full bg-linear-to-br from-fuchsia-500 to-violet-600" />
          <span className="truncate text-sm font-medium">robinbarvaag</span>
        </div>
      </div>
    </aside>
  );
}
