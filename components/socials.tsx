const LABELS: Array<[RegExp, string]> = [
  [/facebook\.com/i, "Facebook"],
  [/instagram\.com/i, "Instagram"],
  [/(?:twitter|x)\.com/i, "X"],
  [/youtube\.com/i, "YouTube"],
  [/linkedin\.com/i, "LinkedIn"],
  [/tiktok\.com/i, "TikTok"],
];

/** Renders a business's social profile links, labeled by platform. */
export function Socials({ urls, className }: { urls?: string[] | null; className?: string }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className={"flex flex-wrap gap-3 text-sm " + (className ?? "")}>
      {urls.map((u) => {
        const label = LABELS.find(([re]) => re.test(u))?.[1] ?? "Link";
        return (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] underline"
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
