import type { CitedSource } from "@/lib/queries/sources";

/**
 * A registry that lets you record which source IDs were cited (in order of appearance)
 * and emit superscript markers `[N]` linking to a footnote anchor.
 */
export class CitationRegistry {
  private order: string[] = [];
  private byId = new Map<string, CitedSource>();

  constructor(public sources: CitedSource[]) {
    for (const s of sources) this.byId.set(s.id, s);
  }

  /** Record one or more sourceIds as cited and return the assigned numbers. */
  cite(...sourceIds: string[]): number[] {
    const nums: number[] = [];
    for (const id of sourceIds) {
      if (!this.byId.has(id)) continue;
      let idx = this.order.indexOf(id);
      if (idx === -1) {
        idx = this.order.length;
        this.order.push(id);
      }
      nums.push(idx + 1);
    }
    return nums;
  }

  /** Sources in citation order, for the footnotes section. */
  cited(): Array<CitedSource & { number: number }> {
    return this.order.map((id, i) => ({ ...(this.byId.get(id) as CitedSource), number: i + 1 }));
  }
}

export function CitationMarker({ numbers }: { numbers: number[] }) {
  if (numbers.length === 0) return null;
  return (
    <sup className="ml-0.5 font-mono text-[0.7em]">
      {numbers.map((n, i) => (
        <span key={n}>
          {i > 0 ? "," : ""}
          <a href={`#source-${n}`} className="citation-link" aria-label={`Source ${n}`}>
            [{n}]
          </a>
        </span>
      ))}
    </sup>
  );
}

export function SourcesList({ sources }: { sources: Array<CitedSource & { number: number }> }) {
  if (sources.length === 0) return null;
  return (
    <section className="mt-12 border-t border-[var(--color-rule)] pt-6">
      <h2 className="font-serif text-lg mb-3">Sources</h2>
      <ol className="space-y-2 text-sm text-[var(--color-muted)]">
        {sources.map((s) => (
          <li key={s.id} id={`source-${s.number}`} className="flex gap-2">
            <span className="font-mono shrink-0">[{s.number}]</span>
            <span>
              {s.title ? <span className="text-[var(--color-ink)]">{s.title}</span> : null}
              {s.publication ? <span>{s.title ? ", " : ""}{s.publication}</span> : null}
              {s.publishedDate ? <span>, {s.publishedDate}</span> : null}
              {". "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                {s.url}
              </a>
              {s.archiveUrl ? (
                <>
                  {" · "}
                  <a href={s.archiveUrl} target="_blank" rel="noreferrer" className="underline">
                    archive
                  </a>
                </>
              ) : null}
              {s.quote ? <span className="block italic mt-1">“{s.quote}”</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
