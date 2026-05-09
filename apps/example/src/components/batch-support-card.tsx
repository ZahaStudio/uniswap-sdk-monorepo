"use client";

import { cn } from "@/lib/utils";

interface BatchSupportCardProps {
  isSupported: boolean;
  description: string;
  batchId?: string;
  callsStatus?: string;
}

export function BatchSupportCard({ isSupported, description, batchId, callsStatus }: BatchSupportCardProps) {
  return (
    <div className="rounded-xl border border-border-muted bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-text-muted">Atomic batching</div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isSupported ? "bg-success-muted text-success" : "bg-warning-muted text-warning",
          )}
        >
          {isSupported ? "Supported" : "Unavailable"}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">{description}</p>

      {(batchId || callsStatus) && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-surface-raised p-2.5">
          {batchId && (
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-text-muted">Batch ID</span>
              <span className="truncate font-mono text-text-secondary">{batchId}</span>
            </div>
          )}
          {callsStatus && (
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-text-muted">Batch status</span>
              <span className="font-medium text-text-secondary">{callsStatus}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
