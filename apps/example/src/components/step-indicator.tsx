"use client";

import type {
  SwapStep,
  UsePermit2SignStep,
  UseTokenApprovalReturn,
  UseTransactionReturn,
} from "@zahastudio/uniswap-sdk-react";

import { StepList, type StepItem } from "@/components/step-list";

interface StepIndicatorProps {
  currentStep: SwapStep;
  approval: UseTokenApprovalReturn;
  permit2: UsePermit2SignStep;
  swapTx: UseTransactionReturn;
  isNativeInput: boolean;
}

export function StepIndicator({ currentStep, approval, permit2, swapTx, isNativeInput }: StepIndicatorProps) {
  const order: SwapStep[] = ["quote", "approval", "permit2", "swap", "completed"];

  function getStatus(stepId: SwapStep): StepItem["status"] {
    if (currentStep === "completed") return "completed";
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  }

  function getLoading(stepId: SwapStep): string | undefined {
    if (stepId === "approval") {
      if (approval.transaction.status === "pending") return "Awaiting wallet...";
      if (approval.transaction.status === "confirming") return "Confirming...";
    }
    if (stepId === "permit2" && permit2.isPending) return "Awaiting signature...";
    if (stepId === "swap") {
      if (swapTx.status === "pending") return "Awaiting wallet...";
      if (swapTx.status === "confirming") return "Confirming...";
    }
    return undefined;
  }

  const steps: StepItem[] = [
    { id: "quote", label: "Quote", description: "Fetch price from Uniswap V4" },
    ...(isNativeInput
      ? []
      : [
          { id: "approval", label: "Approve", description: "Allow Permit2 to spend tokens" },
          { id: "permit2", label: "Permit2", description: "Sign off-chain spending permit" },
        ]),
    { id: "swap", label: "Swap", description: "Execute the swap transaction" },
  ].map((s) => ({
    ...s,
    status: getStatus(s.id as SwapStep),
    loadingLabel: getLoading(s.id as SwapStep),
  }));

  return (
    <StepList
      title="Swap lifecycle"
      steps={steps}
    />
  );
}
