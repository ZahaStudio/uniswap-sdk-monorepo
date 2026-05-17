import { createFileRoute } from "@tanstack/react-router";

import { SwapPage } from "@/components/swap/swap-page";

export const Route = createFileRoute("/swap")({
  component: SwapPage,
});
