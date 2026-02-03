interface LiveBadgeProps {
  className?: string;
}

export function LiveBadge({ className = "" }: LiveBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-black bg-black px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${className}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      LIVE
    </span>
  );
}
