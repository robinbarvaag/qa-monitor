"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@qa/ui/breadcrumb";
import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const projectSlug = pathname.startsWith("/p/") ? decodeURIComponent(pathname.slice(3)) : null;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 md:hidden">
        <div className="grid size-6 place-content-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-3.5" />
        </div>
        <span className="font-heading text-sm font-semibold">qa-monitor</span>
      </Link>

      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            {projectSlug ? (
              <BreadcrumbLink render={<Link href="/" />}>Prosjekter</BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Prosjekter</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {projectSlug && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-mono">{projectSlug}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
