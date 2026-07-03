interface ProgressRingProps {
  done: number;
  total: number;
  size?: number;
}

const RADIUS = 21.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** 完成进度环，对应原型 .ring-wrap */
export function ProgressRing({ done, total, size = 52 }: ProgressRingProps) {
  const ratio = total ? done / total : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r={RADIUS} fill="none" strokeWidth="4.5" className="stroke-black/[.07]" />
        <circle
          cx="26"
          cy="26"
          r={RADIUS}
          fill="none"
          strokeWidth="4.5"
          strokeLinecap="round"
          stroke="var(--color-accent)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12.5px] font-bold tabular-nums text-ink">
        {done}/{total}
      </span>
    </div>
  );
}
