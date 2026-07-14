import React from "react";

type Props = {
  percent: number;
  label?: string;
  className?: string;
  trackClassName?: string;
};

export const WorkProgressBar: React.FC<Props> = ({
  percent,
  label = "Progress",
  className = "",
  trackClassName = "bg-slate-100",
}) => {
  const p = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span>{p}%</span>
      </div>
      <div className="w-full rounded-full bg-white/70 p-[2px] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div
          className={`h-2 w-full ${trackClassName} rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]`}
        >
          <div
            className="h-full bg-blue-600 rounded-full transition-[width] duration-300"
            style={{ width: `${p}%` }}
          />
        </div>
      </div>
    </div>
  );
};
