import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { OpportunityCard } from "@/components/opportunity-card";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import {
  CATEGORIES,
  type Category,
  opportunitiesQuery,
  savedIdsQuery,
} from "@/lib/opportunities";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpportunityHub — Internships, Jobs, Freelance & Hackathons" },
      {
        name: "description",
        content:
          "Discover curated internships, graduate jobs, freelance gigs and hackathons for students. Filter, bookmark and track your applications in one place.",
      },
      {
        property: "og:title",
        content: "OpportunityHub — Opportunities built for students",
      },
      {
        property: "og:description",
        content:
          "Browse internships, full-time jobs, freelance work and hackathons. Save what you like and track every application.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opportunitiesQuery),
  component: Home,
});

type SortKey = "recent" | "deadline";

function Home() {
  const { data: opportunities = [] } = useQuery(opportunitiesQuery);
  const { user } = useSession();
  const queryClient = useQueryClient();
  const savedQuery = savedIdsQuery(user?.id);
  const { data: savedIds = [] } = useQuery(savedQuery);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [location, setLocation] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");

  const locations = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.location))).sort(),
    [opportunities],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = opportunities.filter((o) => {
      if (category !== "all" && o.category !== category) return false;
      if (location !== "all" && o.location !== location) return false;
      if (openOnly && o.status === "closed") return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        o.company.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => {
      if (sort === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      return b.posted_at.localeCompare(a.posted_at);
    });
  }, [opportunities, search, category, location, openOnly, sort]);

  const stats = useMemo(
    () => [
      { label: "Live opportunities", value: opportunities.filter((o) => o.status !== "closed").length },
      { label: "Hiring organisations", value: new Set(opportunities.map((o) => o.company)).size },
      { label: "Remote-friendly", value: opportunities.filter((o) => o.is_remote).length },
      { label: "Closing this week", value: opportunities.filter((o) => o.status === "closing_soon").length },
    ],
    [opportunities],
  );

  async function toggleSave(id: string) {
    if (!user) {
      toast("Sign in to bookmark opportunities");
      return;
    }
    const isSaved = savedIds.includes(id);
    if (isSaved) {
      const { error } = await supabase
        .from("saved_opportunities")
        .delete()
        .eq("opportunity_id", id)
        .eq("user_id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast("Removed from saved");
    } else {
      const { error } = await supabase
        .from("saved_opportunities")
        .insert({ opportunity_id: id, user_id: user.id });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Saved for later");
    }
    queryClient.invalidateQueries({ queryKey: savedQuery.queryKey });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Built for students
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] sm:text-6xl">
            Every internship, job, gig and hackathon worth your time.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            One curated board. Filter by what you care about, bookmark the good ones,
            and keep every application in a single place.
          </p>

          <div className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm">
            <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles, companies, skills…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              aria-label="Search opportunities"
            />
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="text-display mt-1 text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap gap-2">
          <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </CategoryChip>
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </CategoryChip>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="w-[190px] rounded-full">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest first</SelectItem>
              <SelectItem value="deadline">Deadline soonest</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={openOnly ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setOpenOnly((v) => !v)}
          >
            Hide closed
          </Button>

          <span className="ml-auto text-sm text-muted-foreground">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            Nothing matches those filters yet. Try widening your search.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                saved={savedIds.includes(o.id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        OpportunityHub — opportunities, organised.
      </footer>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
