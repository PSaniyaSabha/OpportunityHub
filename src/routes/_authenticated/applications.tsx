import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import {
  applicationStatusLabel,
  applicationsQuery,
  categoryLabel,
} from "@/lib/opportunities";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "My applications — OpportunityHub" },
      {
        name: "description",
        content: "Track the status of every internship, job and hackathon you applied to.",
      },
      { property: "og:title", content: "My applications — OpportunityHub" },
      { property: "og:description", content: "Track every application in one place." },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const appsQ = applicationsQuery(user?.id);
  const { data: applications = [], isLoading } = useQuery(appsQ);

  async function withdraw(id: string) {
    const { error } = await supabase
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: appsQ.queryKey });
    toast("Application withdrawn");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-4xl">Applications</h1>
        <p className="mt-2 text-muted-foreground">
          {applications.length} application{applications.length === 1 ? "" : "s"} submitted.
        </p>

        {!isLoading && applications.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">No applications yet.</p>
            <Button asChild className="mt-4">
              <Link to="/">Find something to apply to</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {applications.map((a) => {
              const o = a.opportunities;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="min-w-0 flex-1">
                    {o && (
                      <Link
                        to="/opportunities/$id"
                        params={{ id: o.id }}
                        className="text-lg hover:underline"
                      >
                        {o.title}
                      </Link>
                    )}
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {o?.company}
                      {o ? ` · ${categoryLabel(o.category)}` : ""} · applied{" "}
                      {new Date(a.applied_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {applicationStatusLabel[a.status]}
                  </Badge>
                  {a.status !== "withdrawn" && (
                    <Button variant="ghost" size="sm" onClick={() => withdraw(a.id)}>
                      Withdraw
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
