"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@qa/ui/sidebar";
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
    <Sidebar>
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2.5 px-2">
          <div className="grid size-7 shrink-0 place-content-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <span className="font-heading text-sm font-semibold">qa-monitor</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.match?.(pathname) ?? pathname === item.href;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.label}>
                    {item.disabled ? (
                      <SidebarMenuButton disabled className="opacity-50">
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-7 shrink-0 rounded-full bg-linear-to-br from-fuchsia-500 to-violet-600" />
          <span className="truncate text-sm font-medium">robinbarvaag</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
