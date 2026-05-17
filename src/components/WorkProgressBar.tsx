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
      <div className={`h-2 w-full ${trackClassName} rounded-full overflow-hidden`}>
        <div className="h-full bg-indigo-500 rounded-full transition-[width] duration-300" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
};
