"use client";

import { useEffect, useState } from "react";

import { normalizeAmountInput } from "@/components/swap/utils";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";

export function SwapSettings({
  slippageBps,
  onSlippageChange,
  useNativeToken,
  onUseNativeTokenChange,
}: {
  slippageBps: number;
  onSlippageChange: (value: number) => void;
  useNativeToken: boolean;
  onUseNativeTokenChange: (value: boolean) => void;
}) {
  const [slippagePercent, setSlippagePercent] = useState(() => formatSlippagePercent(slippageBps));
  const [isEditingSlippage, setIsEditingSlippage] = useState(false);

  useEffect(() => {
    if (!isEditingSlippage) {
      setSlippagePercent(formatSlippagePercent(slippageBps));
    }
  }, [isEditingSlippage, slippageBps]);

  return (
    <FieldGroup className="gap-4">
      <Field>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="use-native-eth">Use native ETH</FieldLabel>
            <FieldDescription>
              Wraps or unwraps ETH through WETH and skips ERC-20 approval for native input.
            </FieldDescription>
          </div>
          <Switch
            aria-label="Use native ETH"
            checked={useNativeToken}
            id="use-native-eth"
            onCheckedChange={onUseNativeTokenChange}
          />
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="slippage-tolerance">Slippage tolerance</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="slippage-tolerance"
            inputMode="decimal"
            onBlur={() => {
              setIsEditingSlippage(false);
              setSlippagePercent(formatSlippagePercent(slippageBps));
            }}
            onChange={(event) => {
              const value = normalizeAmountInput(event.target.value);
              setSlippagePercent(value);

              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed >= 0) {
                onSlippageChange(Math.round(parsed * 100));
              }
            }}
            onFocus={() => setIsEditingSlippage(true)}
            placeholder="0.50"
            value={slippagePercent}
          />
          <InputGroupAddon align="inline-end">%</InputGroupAddon>
        </InputGroup>
        <FieldDescription>The SDK default is 0.5%. High values increase execution risk.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function formatSlippagePercent(slippageBps: number) {
  return String(slippageBps / 100);
}
