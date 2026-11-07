CREATE TABLE public.a2p_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), relationship text NOT NULL DEFAULT 'independent', display_name text NOT NULL DEFAULT '', brand_id text UNIQUE, campaign_id text UNIQUE, brand_status text NOT NULL DEFAULT '', campaign_status text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT 'draft', blocker text, suspended boolean NOT NULL DEFAULT false, submitted_at timestamptz, synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id)
);
GRANT SELECT ON public.a2p_registrations TO authenticated;
GRANT ALL ON public.a2p_registrations TO service_role;
ALTER TABLE public.a2p_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY a2p_read ON public.a2p_registrations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.a2p_private (
 registration_id uuid PRIMARY KEY REFERENCES public.a2p_registrations(id), ciphertext text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.a2p_private TO service_role;
ALTER TABLE public.a2p_private ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.a2p_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES public.a2p_registrations(id), actor_id uuid NOT NULL, kind text NOT NULL, state text NOT NULL DEFAULT 'started', provider_id text, detail text, fee_snapshot jsonb, authorized_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(registration_id,kind)
);
GRANT SELECT ON public.a2p_operations TO authenticated;
GRANT ALL ON public.a2p_operations TO service_role;
ALTER TABLE public.a2p_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY a2p_operations_read ON public.a2p_operations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.a2p_registrations r WHERE r.id = registration_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE TABLE public.a2p_number_links (
 phone_number text PRIMARY KEY, registration_id uuid NOT NULL REFERENCES public.a2p_registrations(id), user_id uuid NOT NULL REFERENCES public.profiles(id), campaign_id text NOT NULL, status text NOT NULL DEFAULT 'pending', verified_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.a2p_number_links TO authenticated;
GRANT ALL ON public.a2p_number_links TO service_role;
ALTER TABLE public.a2p_number_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY a2p_numbers_read ON public.a2p_number_links FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.a2p_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid REFERENCES public.a2p_registrations(id), actor_id uuid NOT NULL, event text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.a2p_audit TO authenticated;
GRANT ALL ON public.a2p_audit TO service_role;
ALTER TABLE public.a2p_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY a2p_audit_read ON public.a2p_audit FOR SELECT TO authenticated USING (actor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.a2p_rate_limits (user_id uuid NOT NULL, action text NOT NULL, last_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,action));
GRANT ALL ON public.a2p_rate_limits TO service_role;
ALTER TABLE public.a2p_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.a2p_take_rate_limit(p_user uuid, p_action text, p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE taken boolean;
BEGIN
 INSERT INTO public.a2p_rate_limits(user_id,action,last_at) VALUES(p_user,p_action,now()) ON CONFLICT(user_id,action) DO UPDATE SET last_at = now() WHERE a2p_rate_limits.last_at < now() - make_interval(secs => p_seconds) RETURNING true INTO taken;
 RETURN coalesce(taken,false);
END; $$;
REVOKE ALL ON FUNCTION public.a2p_take_rate_limit(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.a2p_take_rate_limit(uuid,text,integer) TO service_role;