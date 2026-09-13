import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarDays,
  Clock,
  MapPin,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import {
  applicationsQuery,
  categoryLabel,
  deadlineText,
  opportunityQuery,
  savedIdsQuery,
  statusLabel,
} from "@/lib/opportunities";

export const Route = createFileRoute("/opportunities/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(opportunityQuery(params.id)),
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} at ${loaderData.company}` : "Opportunity";
    const description = loaderData
      ? loaderData.description.slice(0, 155)
      : "Opportunity details on OpportunityHub.";
    return {
      meta: [
        { title: `${title} — OpportunityHub` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => (
    <div className="p-16 text-center text-muted-foreground">
      We couldn't load this opportunity.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-16 text-center text-muted-foreground">Opportunity not found.</div>
  ),
  component: OpportunityDetail,
});

function OpportunityDetail() {
  const { id } = Route.useParams();
  const { data: opportunity } = useQuery(opportunityQuery(id));
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const savedQ = savedIdsQuery(user?.id);
  const { data: savedIds = [] } = useQuery(savedQ);
  const appsQ = applicationsQuery(user?.id);
  const { data: applications = [] } = useQuery(appsQ);

  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [busy, setBusy] = useState(false);

  if (!opportunity) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <p className="p-16 text-center text-muted-foreground">Opportunity not found.</p>
      </div>
    );
  }

  const saved = savedIds.includes(opportunity.id);
  const applied = applications.some((a) => a.opportunity_id === opportunity.id);

  async function toggleSave() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (saved) {
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
    queryClient.invalidateQueries({ queryKey: savedQ.queryKey });
  }

  async function submitApplication() {
    if (!user) return;
    setBusy(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_url")
      .eq("id", user.id)
      .maybeSingle();
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      opportunity_id: id,
      cover_letter: coverLetter || null,
      resume_url: profile?.resume_url ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setCoverLetter("");
    queryClient.invalidateQueries({ queryKey: appsQ.queryKey });
    toast.success("Application submitted");
  }

  const facts = [
    { icon: Building2, label: "Organisation", value: opportunity.company },
    {
      icon: MapPin,
      label: "Location",
      value: opportunity.is_remote ? "Remote" : opportunity.location,
    },
    { icon: Wallet, label: "Compensation", value: opportunity.compensation ?? "Not disclosed" },
    { icon: Clock, label: "Duration", value: opportunity.duration ?? "Flexible" },
    {
      icon: CalendarDays,
      label: "Deadline",
      value: opportunity.deadline
        ? new Date(opportunity.deadline).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Rolling",
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all opportunities
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full font-normal">
            {categoryLabel(opportunity.category)}
          </Badge>
          <Badge
            className="rounded-full font-normal"
            variant={opportunity.status === "closed" ? "outline" : "default"}
          >
            {statusLabel[opportunity.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {deadlineText(opportunity.deadline)}
          </span>
        </div>

        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">{opportunity.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{opportunity.company}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={applied || opportunity.status === "closed"}
            onClick={() => (user ? setOpen(true) : navigate({ to: "/auth" }))}
          >
            {opportunity.status === "closed"
              ? "Applications closed"
              : applied
                ? "Application submitted"
                : "Apply now"}
          </Button>
          <Button variant="outline" size="lg" onClick={toggleSave}>
            {saved ? (
              <>
                <BookmarkCheck className="mr-2 h-4 w-4" /> Saved
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" /> Save
              </>
            )}
          </Button>
        </div>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="bg-card p-5">
              <dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <f.icon className="h-3.5 w-3.5" /> {f.label}
              </dt>
              <dd className="mt-1.5 text-sm font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-10">
          <h2 className="text-2xl">About this opportunity</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
            {opportunity.description}
          </p>
        </section>

        {opportunity.tags.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl">Skills &amp; tags</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {opportunity.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-surface px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to {opportunity.title}</DialogTitle>
            <DialogDescription>
              Your saved résumé is attached automatically. Add a short note to stand out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cover">Why you're a good fit (optional)</Label>
            <Textarea
              id="cover"
              rows={6}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="A few sentences about your experience and motivation…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitApplication} disabled={busy}>
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
