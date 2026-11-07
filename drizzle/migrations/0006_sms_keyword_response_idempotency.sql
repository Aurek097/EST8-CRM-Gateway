CREATE TABLE public.sms_keyword_responses(event_id text PRIMARY KEY, state text NOT NULL DEFAULT 'started', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.sms_keyword_responses TO service_role;
ALTER TABLE public.sms_keyword_responses ENABLE ROW LEVEL SECURITY;