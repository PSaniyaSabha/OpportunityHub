import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — OpportunityHub" },
      {
        name: "description",
        content:
          "Keep your student profile, skills, avatar and résumé up to date so applications take seconds.",
      },
      { property: "og:title", content: "Your profile — OpportunityHub" },
      { property: "og:description", content: "Manage your student profile and résumé." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const resumeInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const profileQ = {
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
  const { data: profile } = useQuery(profileQ);

  const [form, setForm] = useState({
    full_name: "",
    headline: "",
    university: "",
    graduation_year: "",
    location: "",
    skills: "",
  });
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      headline: profile.headline ?? "",
      university: profile.university ?? "",
      graduation_year: profile.graduation_year ? String(profile.graduation_year) : "",
      location: profile.location ?? "",
      skills: profile.skills.join(", "),
    });
    if (profile.avatar_url) {
      supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 3600)
        .then(({ data }) => setAvatarPreview(data?.signedUrl ?? null));
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name || null,
      headline: form.headline || null,
      university: form.university || null,
      graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
      location: form.location || null,
      skills: form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: profileQ.queryKey });
    toast.success("Profile saved");
  }

  async function upload(bucket: "resumes" | "avatars", file: File) {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const patch =
      bucket === "resumes" ? { resume_url: path } : { avatar_url: path };
    const { error: dbError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...patch });
    if (dbError) {
      toast.error(dbError.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: profileQ.queryKey });
    toast.success(bucket === "resumes" ? "Résumé uploaded" : "Photo updated");
  }

  const initials = (form.full_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-4xl">Your profile</h1>
        <p className="mt-2 text-muted-foreground">
          Applications reuse this information, so keep it current.
        </p>

        <div className="mt-8 flex items-center gap-4">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Your profile photo"
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl text-primary-foreground">
              {initials}
            </div>
          )}
          <div>
            <Button variant="outline" size="sm" onClick={() => avatarInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Change photo
            </Button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("avatars", f);
              }}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
          </div>
        </div>

        <form onSubmit={save} className="mt-8 space-y-5">
          <Field label="Full name" id="full_name">
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Headline" id="headline">
            <Input
              id="headline"
              placeholder="Final-year CS student · aspiring product engineer"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="University" id="university">
              <Input
                id="university"
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
              />
            </Field>
            <Field label="Graduation year" id="graduation_year">
              <Input
                id="graduation_year"
                type="number"
                min={1980}
                max={2100}
                value={form.graduation_year}
                onChange={(e) => setForm({ ...form, graduation_year: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Location" id="location">
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Skills (comma separated)" id="skills">
            <Textarea
              id="skills"
              rows={3}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </Field>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Résumé</p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.resume_url
                    ? profile.resume_url.split("/").pop()
                    : "No résumé uploaded yet"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resumeInput.current?.click()}
              >
                Upload
              </Button>
              <input
                ref={resumeInput}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("resumes", f);
                }}
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
