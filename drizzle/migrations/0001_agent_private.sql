CREATE TABLE public.agent_private (
  user_id uuid PRIMARY KEY,
  dob date,
  dl_number text,
  dl_state text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_private TO authenticated;
GRANT ALL ON public.agent_private TO service_role;
ALTER TABLE public.agent_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own private info" ON public.agent_private FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner inserts own private info" ON public.agent_private FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own private info" ON public.agent_private FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes own private info" ON public.agent_private FOR DELETE TO authenticated USING (auth.uid() = user_id);