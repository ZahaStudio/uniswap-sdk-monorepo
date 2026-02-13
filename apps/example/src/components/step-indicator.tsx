"use client";

import type {
  SwapStep,
  UsePermit2SignStep,
  UseTokenApprovalReturn,
  UseTransactionReturn,
} from "@zahastudio/uniswap-sdk-react";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: SwapStep;
  approval: UseTokenApprovalReturn;
  permit2: UsePermit2SignStep;
  swapTx: UseTransactionReturn;
  isNativeInput: boolean;
}

interface StepItem {
  id: SwapStep;
  label: string;
  description: string;
}

export function StepIndicator({ currentStep, approval, permit2, swapTx, isNativeInput }: StepIndicatorProps) {
  const getStepLoading = (stepId: SwapStep): string | undefined => {
    if (stepId === "approval") {
      const s = approval.transaction.status;
      if (s === "pending") return "Awaiting wallet...";
      if (s === "confirming") return "Confirming...";
    }
    if (stepId === "permit2") {
      if (permit2.isPending) return "Awaiting signature...";
    }
    if (stepId === "swap") {
      const s = swapTx.status;
      if (s === "pending") return "Awaiting wallet...";
      if (s === "confirming") return "Confirming...";
    }
    return undefined;
  };

  const allSteps: StepItem[] = [
    {
      id: "quote",
      label: "Quote",
      description: "Fetch price from Uniswap V4",
    },
    ...(isNativeInput
      ? []
      : [
          {
            id: "approval" as SwapStep,
            label: "Approve",
            description: "Allow Permit2 to spend tokens",
          },
          {
            id: "permit2" as SwapStep,
            label: "Permit2",
            description: "Sign off-chain spending permit",
          },
        ]),
    {
      id: "swap",
      label: "Swap",
      description: "Execute the swap transaction",
    },
  ];

  const getStepStatus = (stepId: SwapStep) => {
    const order: SwapStep[] = ["quote", "approval", "permit2", "swap", "completed"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepId);

    if (currentStep === "completed") return "completed";
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="border-border-muted bg-surface rounded-xl border p-4">
      <div className="text-text-muted mb-3 text-xs font-medium">Swap lifecycle</div>

      <div className="space-y-1">
        {allSteps.map((step, i) => {
          const status = getStepStatus(step.id);
          const loadingLabel = getStepLoading(step.id);
          return (
            <div
              key={step.id}
              className="flex items-start gap-3"
            >
              {/* Step indicator dot */}
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                    status === "completed" && "border-success bg-success text-white",
                    status === "active" && "border-accent bg-accent-muted text-accent",
                    status === "pending" && "border-border text-text-muted bg-transparent",
                  )}
                >
                  {status === "completed" ? (
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
                  ) : status === "active" ? (
                    <div className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
                  ) : (
                    <div className="bg-text-muted/40 h-1.5 w-1.5 rounded-full" />
                  )}
                </div>
                {/* Connector line */}
                {i < allSteps.length - 1 && (
                  <div
                    className={cn(
                      "my-0.5 h-4 w-0.5 rounded-full",
                      status === "completed" ? "bg-success/40" : "bg-border-muted",
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="min-w-0 flex-1 pb-1">
                <div
                  className={cn(
                    "text-xs font-medium",
                    status === "completed" && "text-success",
                    status === "active" && "text-accent",
                    status === "pending" && "text-text-muted",
                  )}
                >
                  {step.label}
                </div>
                <div className="text-text-muted text-[11px]">{step.description}</div>
              </div>

              {/* Loading indicator */}
              {loadingLabel && (
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
                  <span className="text-accent text-[11px] font-medium whitespace-nowrap">{loadingLabel}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
