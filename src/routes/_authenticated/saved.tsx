import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { OpportunityCard } from "@/components/opportunity-card";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { opportunitiesQuery, savedIdsQuery } from "@/lib/opportunities";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved opportunities — OpportunityHub" },
      {
        name: "description",
        content: "Every internship, job, gig and hackathon you bookmarked, in one list.",
      },
      { property: "og:title", content: "Saved opportunities — OpportunityHub" },
      { property: "og:description", content: "Your bookmarked opportunities." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const savedQ = savedIdsQuery(user?.id);
  const { data: savedIds = [], isLoading } = useQuery(savedQ);
  const { data: opportunities = [] } = useQuery(opportunitiesQuery);

  const saved = opportunities.filter((o) => savedIds.includes(o.id));

  async function remove(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("opportunity_id", id)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: savedQ.queryKey });
    toast("Removed from saved");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl">Saved</h1>
        <p className="mt-2 text-muted-foreground">
          {saved.length} bookmarked opportunit{saved.length === 1 ? "y" : "ies"}.
        </p>

        {!isLoading && saved.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">You haven't saved anything yet.</p>
            <Button asChild className="mt-4">
              <Link to="/">Browse opportunities</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} saved onToggleSave={remove} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
