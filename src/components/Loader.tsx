import React from "react";

interface LoaderProps {
  label?: string;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ label, className = "" }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="loader" />
      {label && (
        <span className="text-xs text-[var(--text-muted)] font-mono tracking-wider animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
