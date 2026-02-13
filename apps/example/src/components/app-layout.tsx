"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Header } from "@/components/header";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/swap", label: "Swap" },
  { href: "/position", label: "Position" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-accent/4 absolute -top-40 -left-40 h-150 w-150 rounded-full blur-[120px]" />
        <div className="bg-accent/3 absolute -right-40 -bottom-40 h-125 w-125 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <Header />

        {/* Navigation tabs */}
        <nav className="mt-6 flex justify-center gap-1.5">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium transition-all",
                pathname === tab.href
                  ? "border-accent/30 bg-accent-muted text-accent border"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <main className="flex flex-1 flex-col items-center justify-center pb-16">{children}</main>

        <footer className="text-text-muted flex items-center justify-center py-6 text-xs">
          <span>
            Built with <code className="text-text-secondary font-mono">@zahastudio/uniswap-sdk-react</code>
          </span>
        </footer>
      </div>
    </div>
  );
}
