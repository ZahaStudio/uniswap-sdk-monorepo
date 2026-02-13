"use client";

import type { ReactNode } from "react";

import dynamic from "next/dynamic";

const Providers = dynamic(() => import("./providers").then((mod) => ({ default: mod.Providers })), {
  ssr: false,
});

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
