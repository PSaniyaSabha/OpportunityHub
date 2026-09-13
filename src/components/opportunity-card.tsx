import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type Opportunity,
  categoryLabel,
  daysLeft,
  deadlineText,
  statusLabel,
} from "@/lib/opportunities";

export function OpportunityCard({
  opportunity,
  saved,
  onToggleSave,
}: {
  opportunity: Opportunity;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
}) {
  const left = daysLeft(opportunity.deadline);
  const urgent = left !== null && left >= 0 && left <= 7;

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="secondary" className="rounded-full font-normal">
            {categoryLabel(opportunity.category)}
          </Badge>
          <h3 className="mt-3 text-xl leading-snug">
            <Link
              to="/opportunities/$id"
              params={{ id: opportunity.id }}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {opportunity.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{opportunity.company}</p>
        </div>
        {onToggleSave && (
          <button
            type="button"
            aria-label={saved ? "Remove bookmark" : "Save opportunity"}
            onClick={(e) => {
              e.preventDefault();
              onToggleSave(opportunity.id);
            }}
            className="relative z-10 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {opportunity.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {opportunity.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {opportunity.is_remote ? "Remote" : opportunity.location}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            urgent && "font-medium text-highlight-foreground",
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {deadlineText(opportunity.deadline)}
        </span>
        {opportunity.compensation && (
          <span className="ml-auto font-medium text-foreground">
            {opportunity.compensation}
          </span>
        )}
      </div>

      {opportunity.status !== "open" && (
        <span
          className={cn(
            "absolute right-5 top-[-10px] rounded-full px-2.5 py-1 text-[11px] font-medium",
            opportunity.status === "closed"
              ? "bg-muted text-muted-foreground"
              : "bg-highlight text-highlight-foreground",
          )}
        >
          {statusLabel[opportunity.status]}
        </span>
      )}
    </article>
  );
}
