import type { ReactNode } from "react";

export default function MetricCard({ title, className = "", children }: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`public-metric-card ${className}`}>
      <h2>{title}</h2>
      {children}
    </article>
  );
}
