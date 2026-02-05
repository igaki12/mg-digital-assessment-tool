import type { ReactNode } from "react";

export default function StatCard({
  title,
  value,
  note,
  children
}: {
  title: string;
  value: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card stat-card">
      <div>
        <p className="card-title">{title}</p>
        <p className="stat-value">{value}</p>
        {note ? <p className="card-note">{note}</p> : null}
      </div>
      {children ? <div className="card-aside">{children}</div> : null}
    </div>
  );
}
