"use client";

import { GlobalSearch } from "@/components/global-search";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@qa/ui/breadcrumb";
import { Separator } from "@qa/ui/separator";
import { SidebarTrigger } from "@qa/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const projectSlug = pathname.startsWith("/p/") ? decodeURIComponent(pathname.slice(3)) : null;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 ml-1 h-full self-stretch" />
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
      <div className="ml-auto">
        <GlobalSearch />
      </div>
    </header>
  );
}
