"use client";

import { useRouterState } from "@tanstack/react-router";
import { SendIcon, BellIcon } from "lucide-react";

import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { getActiveNavItem } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import { DecorIcon } from "@/components/ui/decor-icon";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activeItem = getActiveNavItem(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6",
        "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50",
      )}
    >
      <DecorIcon
        className="hidden md:block"
        position="bottom-left"
      />
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs page={activeItem} />
      </div>
      <div className="flex items-center gap-3">
        <Button
          aria-label="Send update"
          size="icon-sm"
          variant="outline"
        >
          <SendIcon />
        </Button>
        <Button
          aria-label="Notifications"
          size="icon-sm"
          variant="outline"
        >
          <BellIcon />
        </Button>
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
