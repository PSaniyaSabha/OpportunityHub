import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
export type Category = Database["public"]["Enums"]["opportunity_category"];
export type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const CATEGORIES: { value: Category; label: string; blurb: string }[] = [
  { value: "internship", label: "Internships", blurb: "Learn on a real team" },
  { value: "fulltime", label: "Full-time Jobs", blurb: "Start your career" },
  { value: "freelance", label: "Freelance", blurb: "Paid project work" },
  { value: "hackathon", label: "Hackathons", blurb: "Build in a weekend" },
];

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const statusLabel: Record<Opportunity["status"], string> = {
  open: "Open",
  closing_soon: "Closing soon",
  closed: "Closed",
};

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  applied: "Applied",
  in_review: "In review",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const end = new Date(`${deadline}T23:59:59`).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function deadlineText(deadline: string | null): string {
  const d = daysLeft(deadline);
  if (d === null) return "Rolling deadline";
  if (d < 0) return "Deadline passed";
  if (d === 0) return "Closes today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

export const opportunitiesQuery = queryOptions({
  queryKey: ["opportunities"],
  queryFn: async (): Promise<Opportunity[]> => {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .order("posted_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const opportunityQuery = (id: string) =>
  queryOptions({
    queryKey: ["opportunity", id],
    queryFn: async (): Promise<Opportunity | null> => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const savedIdsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["saved", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("saved_opportunities")
        .select("opportunity_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.opportunity_id);
    },
  });

export const applicationsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["applications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, opportunities(*)")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
