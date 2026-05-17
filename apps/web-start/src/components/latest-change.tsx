"use client";

import { useState } from "react";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const latestChange = {
  badge: "CHANGELOG",
  title: "Product update",
  description: "Performance boosts and UI polish.", // TIP: Use a single line of text for the description. (max 5 words)
  readMore: { href: "#", label: "Learn more" },
} as const;

export function LatestChange() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "group/latest-change size-full min-h-27 justify-center border-t",
        "relative flex size-full flex-col gap-1 overflow-hidden px-4 pt-3 pb-1 *:text-nowrap",
        "transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0",
      )}
    >
      <span className="text-muted-foreground font-mono text-[10px] font-light">{latestChange.badge}</span>
      <p className="text-xs font-medium">{latestChange.title}</p>
      <span className="text-muted-foreground text-[10px]">{latestChange.description}</span>
      <Button
        asChild
        className="w-max px-0 text-xs font-light"
        size="sm"
        variant="link"
      >
        <a href={latestChange.readMore.href}>{latestChange.readMore.label}</a>
      </Button>
      <Button
        aria-label="Dismiss product update"
        className="absolute top-2 right-2 z-10 size-6 rounded-full opacity-0 transition-opacity group-hover/latest-change:opacity-100"
        onClick={() => setIsOpen(false)}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon />{" "}
      </Button>
    </div>
  );
}
