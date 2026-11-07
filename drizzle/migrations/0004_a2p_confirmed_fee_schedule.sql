CREATE TABLE public.a2p_fee_schedule (id text PRIMARY KEY DEFAULT 'current', brand_fee numeric NOT NULL, campaign_review_fee numeric NOT NULL, currency text NOT NULL DEFAULT 'USD', source text NOT NULL, confirmed_by uuid NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.a2p_fee_schedule TO authenticated;
GRANT ALL ON public.a2p_fee_schedule TO service_role;
ALTER TABLE public.a2p_fee_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY a2p_fee_read ON public.a2p_fee_schedule FOR SELECT TO authenticated USING (true);