import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { wasiColors } from "../tokens/colors";

interface WASICardProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  className?: string;
  children: ReactNode;
}

export function WASICard({
  title,
  subtitle,
  accentColor = wasiColors.primary,
  className,
  children,
}: WASICardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <header
        className="px-4 py-3"
        style={{
          background: `linear-gradient(120deg, ${accentColor}, ${wasiColors.dark})`,
          color: "#ffffff",
        }}
      >
        <h3 className="text-lg font-semibold tracking-wide">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm opacity-90">{subtitle}</p> : null}
      </header>
      <div className="bg-[color:var(--wasi-light)] p-4">{children}</div>
    </section>
  );
}
