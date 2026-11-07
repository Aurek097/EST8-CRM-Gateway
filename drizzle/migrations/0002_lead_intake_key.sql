ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intake_key text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_intake_key_idx ON public.profiles(intake_key);
CREATE INDEX IF NOT EXISTS sms_messages_telnyx_idx ON public.sms_messages(telnyx_message_id);
CREATE INDEX IF NOT EXISTS phone_numbers_number_idx ON public.phone_numbers(phone_number);