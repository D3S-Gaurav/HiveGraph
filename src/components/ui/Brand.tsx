import { HiveGraphMark } from "./HiveGraphMark";

export function HiveGraphBrand({
  compact = false,
  tagline,
}: {
  compact?: boolean;
  tagline?: string;
}) {
  return (
    <div className={`hivegraph-brand${compact ? " is-compact" : ""}`}>
      <HiveGraphMark size={compact ? 34 : 42} />
      <div className="hivegraph-brand-copy">
        <span className="hivegraph-wordmark">HiveGraph</span>
        {tagline ? <span className="hivegraph-tagline">{tagline}</span> : null}
      </div>
    </div>
  );
}
