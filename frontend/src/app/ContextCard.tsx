import type { ReactNode } from "react";

export default function ContextCard({ title, facts, children }: {
  title: string;
  facts: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <section className="workspace-card context-card">
      <h2>{title}</h2>
      <dl>
        {facts.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
