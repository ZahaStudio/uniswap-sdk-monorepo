"use client";

import { cn } from "@/lib/utils";

export interface StepItem {
  id: string;
  label: string;
  description: string;
  status: "pending" | "active" | "completed";
  loadingLabel?: string;
}

interface StepListProps {
  title: string;
  steps: StepItem[];
  children?: React.ReactNode;
}

export function StepList({ title, steps, children }: StepListProps) {
  return (
    <div className="border-border-muted bg-surface rounded-xl border p-4">
      <div className="text-text-muted mb-3 text-xs font-medium">{title}</div>

      <div className="space-y-1">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className="flex items-start gap-3"
          >
            {/* Step dot + connector */}
            <div className="flex flex-col items-center pt-0.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                  step.status === "completed" && "border-success bg-success text-white",
                  step.status === "active" && "border-accent bg-accent-muted text-accent",
                  step.status === "pending" && "border-border text-text-muted bg-transparent",
                )}
              >
                {step.status === "completed" ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : step.status === "active" ? (
                  <div className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
                ) : (
                  <div className="bg-text-muted/40 h-1.5 w-1.5 rounded-full" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "my-0.5 h-4 w-0.5 rounded-full",
                    step.status === "completed" ? "bg-success/40" : "bg-border-muted",
                  )}
                />
              )}
            </div>

            {/* Step label + description */}
            <div className="min-w-0 flex-1 pb-1">
              <div
                className={cn(
                  "text-xs font-medium",
                  step.status === "completed" && "text-success",
                  step.status === "active" && "text-accent",
                  step.status === "pending" && "text-text-muted",
                )}
              >
                {step.label}
              </div>
              <div className="text-text-muted text-[11px]">{step.description}</div>
            </div>

            {/* Loading spinner */}
            {step.loadingLabel && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-accent animate-spin"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-20"
                  />
                  <path
                    d="M22 12a10 10 0 0 0-10-10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-accent text-[11px] font-medium whitespace-nowrap">{step.loadingLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}
