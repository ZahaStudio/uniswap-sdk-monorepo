import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
}

export function RefreshButton({ onClick, disabled, spinning }: RefreshButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-text-muted hover:text-accent flex items-center gap-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        className={cn(spinning && "animate-spin")}
      >
        <path
          d="M21 12a9 9 0 1 1-2.636-6.364"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M21 3v6h-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
