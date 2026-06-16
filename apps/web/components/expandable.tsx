"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Klamrer innhold til `collapsedHeight` px og viser «Vis mer / Vis mindre» når
 * det er mer. Bruker en CSS-maske til uttoningen, så den virker uavhengig av
 * bakgrunnsfarge (ingen gradient-overlay som må matche bg).
 */
export function Expandable({
  children,
  collapsedHeight = 160,
  className,
  moreLabel = "Vis mer",
  lessLabel = "Vis mindre",
}: {
  children: ReactNode;
  collapsedHeight?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > collapsedHeight + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsedHeight]);

  const clamped = overflows && !expanded;

  return (
    <div className={className}>
      <div
        ref={ref}
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: clamped ? collapsedHeight : undefined,
          maskImage: clamped
            ? "linear-gradient(to bottom, black calc(100% - 2.5rem), transparent)"
            : undefined,
          WebkitMaskImage: clamped
            ? "linear-gradient(to bottom, black calc(100% - 2.5rem), transparent)"
            : undefined,
        }}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}
