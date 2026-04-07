"use client";

import { Header } from "@/components/header";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-150 w-150 rounded-full bg-accent/4 blur-[120px]" />
        <div className="absolute -right-40 -bottom-40 h-125 w-125 rounded-full bg-accent/3 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pt-20 pb-6">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center pb-16">{children}</main>
        <footer className="flex items-center justify-center py-6 text-xs text-text-muted">
          <span>
            Built with <code className="font-mono text-text-secondary">@zahastudio/uniswap-sdk-react</code>
          </span>
        </footer>
      </div>
    </div>
  );
}
