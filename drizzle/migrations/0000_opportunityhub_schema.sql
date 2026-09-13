-- Enums
CREATE TYPE public.opportunity_category AS ENUM ('internship', 'fulltime', 'freelance', 'hackathon');
CREATE TYPE public.opportunity_status AS ENUM ('open', 'closing_soon', 'closed');
CREATE TYPE public.application_status AS ENUM ('applied', 'in_review', 'interview', 'accepted', 'rejected', 'withdrawn');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  university TEXT,
  graduation_year INT,
  location TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  avatar_url TEXT,
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Opportunities (publicly readable)
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo_url TEXT,
  description TEXT NOT NULL,
  category public.opportunity_category NOT NULL,
  location TEXT NOT NULL DEFAULT 'Remote',
  is_remote BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  compensation TEXT,
  duration TEXT,
  apply_url TEXT,
  status public.opportunity_status NOT NULL DEFAULT 'open',
  deadline DATE,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Opportunities are publicly readable" ON public.opportunities FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_opportunities_category ON public.opportunities (category);
CREATE INDEX idx_opportunities_status ON public.opportunities (status);
CREATE INDEX idx_opportunities_deadline ON public.opportunities (deadline);
CREATE INDEX idx_opportunities_posted_at ON public.opportunities (posted_at DESC);
CREATE INDEX idx_opportunities_tags ON public.opportunities USING GIN (tags);

-- Saved opportunities
CREATE TABLE public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_opportunities TO authenticated;
GRANT ALL ON public.saved_opportunities TO service_role;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saves" ON public.saved_opportunities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can save" ON public.saved_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave" ON public.saved_opportunities FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_saved_user ON public.saved_opportunities (user_id);
CREATE INDEX idx_saved_opportunity ON public.saved_opportunities (opportunity_id);

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'applied',
  cover_letter TEXT,
  resume_url TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own applications" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own applications" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_applications_user ON public.applications (user_id);
CREATE INDEX idx_applications_opportunity ON public.applications (opportunity_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed data
INSERT INTO public.opportunities (title, company, description, category, location, is_remote, tags, compensation, duration, status, deadline, posted_at) VALUES
('Frontend Engineering Intern', 'Northwind Labs', 'Join our product team to build accessible React interfaces used by 2M students. You will pair with senior engineers, ship weekly, and own a feature end to end.', 'internship', 'Bengaluru, India', false, ARRAY['React','TypeScript','CSS','Figma'], 'INR 60,000 / month', '6 months', 'open', CURRENT_DATE + 24, now() - interval '2 days'),
('Data Science Intern', 'Helix Analytics', 'Work with our research team on churn prediction models. Strong Python and statistics fundamentals required; no prior industry experience needed.', 'internship', 'Remote', true, ARRAY['Python','Pandas','ML','SQL'], '$25 / hour', '3 months', 'closing_soon', CURRENT_DATE + 4, now() - interval '9 days'),
('Product Design Intern', 'Lumen Studio', 'Help craft design systems and high-fidelity prototypes for early-stage fintech clients. Portfolio required.', 'internship', 'Berlin, Germany', false, ARRAY['Figma','Design Systems','Prototyping'], '€1,800 / month', '4 months', 'open', CURRENT_DATE + 31, now() - interval '5 days'),
('Junior Backend Engineer', 'Cobalt Systems', 'Own services in a Go and Postgres stack serving millions of daily requests. Mentorship-heavy team, graduates welcome.', 'fulltime', 'Remote', true, ARRAY['Go','PostgreSQL','Docker','AWS'], '$95,000 / year', 'Full-time', 'open', CURRENT_DATE + 40, now() - interval '1 day'),
('Associate Product Manager', 'Meridian', 'Two-year rotational APM program for new graduates. Rotate across growth, platform, and marketplace teams.', 'fulltime', 'London, UK', false, ARRAY['Product','Analytics','Strategy'], '£48,000 / year', 'Full-time', 'closing_soon', CURRENT_DATE + 6, now() - interval '12 days'),
('Graduate Cloud Engineer', 'Stratus Cloud', 'Build and automate infrastructure for enterprise customers. Certification support and a structured 12-week bootcamp included.', 'fulltime', 'Toronto, Canada', false, ARRAY['Kubernetes','Terraform','CI/CD'], 'CAD 78,000 / year', 'Full-time', 'open', CURRENT_DATE + 50, now() - interval '7 days'),
('Freelance Technical Writer', 'DevDocs Collective', 'Write developer tutorials on modern web frameworks. Paid per published article, flexible schedule, byline included.', 'freelance', 'Remote', true, ARRAY['Writing','Documentation','JavaScript'], '$250 / article', 'Ongoing', 'open', CURRENT_DATE + 18, now() - interval '3 days'),
('Freelance Mobile Developer', 'Fernweh Travel', 'Ship two screens and offline caching for our React Native travel app. Clear scope, 6-week engagement.', 'freelance', 'Remote', true, ARRAY['React Native','Expo','TypeScript'], '$4,000 fixed', '6 weeks', 'open', CURRENT_DATE + 14, now() - interval '4 days'),
('Freelance Brand Illustrator', 'Paper Crane', 'Create a set of 12 spot illustrations for a student finance brand refresh. Portfolio-first application.', 'freelance', 'Remote', true, ARRAY['Illustration','Branding','Adobe'], '$1,500 fixed', '3 weeks', 'closed', CURRENT_DATE - 3, now() - interval '30 days'),
('HackTheCampus 2026', 'Campus Collective', '48-hour national student hackathon with tracks in climate tech, health, and education. Travel grants available.', 'hackathon', 'Mumbai, India', false, ARRAY['48h','Teams of 4','Climate','Health'], 'INR 5,00,000 prize pool', '48 hours', 'open', CURRENT_DATE + 21, now() - interval '6 days'),
('Global AI Sprint', 'OpenFuture Foundation', 'Online hackathon building responsible AI tools. Mentors from leading research labs, beginner track available.', 'hackathon', 'Remote', true, ARRAY['AI','Online','Beginner Friendly'], '$20,000 prize pool', '1 week', 'closing_soon', CURRENT_DATE + 5, now() - interval '10 days'),
('FinTech Build Weekend', 'Ledger Guild', 'Prototype the future of student banking in one weekend. Free meals, workspace, and API credits provided.', 'hackathon', 'Singapore', false, ARRAY['FinTech','APIs','Weekend'], 'SGD 15,000 prize pool', '2 days', 'open', CURRENT_DATE + 35, now() - interval '8 days');