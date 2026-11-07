-- Roles
create type public.app_role as enum ('admin', 'agent');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  npn text,
  avatar_url text,
  licensed_states text[] not null default '{}',
  is_active boolean not null default false,
  profile jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"offerTimeA":"5:15 pm","offerTimeB":"6:45 pm"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Read own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Update own profile or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Non-admins can't change their own active flag or email
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') and auth.uid() is not null then
    new.is_active := old.is_active;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Invites (pre-registered agents)
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  phone text,
  npn text,
  licensed_states text[] not null default '{}',
  role public.app_role not null default 'agent',
  invited_by uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;
create policy "Admins manage invites" on public.invites for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Grant access: invited emails get their role; the very first user becomes admin.
create or replace function public.grant_access_for(_uid uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype;
begin
  if exists (select 1 from public.user_roles where user_id = _uid) then return; end if;
  select * into inv from public.invites where lower(email) = lower(_email) limit 1;
  if found then
    insert into public.user_roles(user_id, role) values (_uid, inv.role) on conflict do nothing;
    update public.profiles set is_active = true,
      full_name = coalesce(inv.full_name, full_name),
      phone = coalesce(inv.phone, phone), npn = coalesce(inv.npn, npn),
      licensed_states = case when array_length(inv.licensed_states,1) > 0 then inv.licensed_states else licensed_states end
      where id = _uid;
    update public.invites set claimed_at = now() where id = inv.id;
  elsif not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (_uid, 'admin');
    update public.profiles set is_active = true where id = _uid;
  end if;
end $$;
revoke execute on function public.grant_access_for(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, avatar_url)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  perform public.grant_access_for(new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Retry from the blocked screen
create or replace function public.claim_access()
returns boolean language plpgsql security definer set search_path = public as $$
declare _email text;
begin
  if auth.uid() is null then return false; end if;
  select email into _email from auth.users where id = auth.uid();
  insert into public.profiles(id, email) values (auth.uid(), _email) on conflict (id) do nothing;
  perform public.grant_access_for(auth.uid(), _email);
  return exists (select 1 from public.user_roles where user_id = auth.uid());
end $$;
revoke execute on function public.claim_access() from public, anon;
grant execute on function public.claim_access() to authenticated;

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_type text not null default 'mp' check (lead_type in ('mp','fe')),
  status text not null default 'new',
  first_name text, last_name text, phone text, phone_digits text, email text,
  address text, city text, state text, zip text,
  lead_source text, lead_date timestamptz,
  sms_opt_out boolean not null default false,
  sample boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  verify jsonb not null default '{}'::jsonb,
  orig jsonb not null default '{}'::jsonb,
  stage_at jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  dials int not null default 0,
  last_dial timestamptz,
  follow_at timestamptz, follow_what text,
  step int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_user_idx on public.leads(user_id);
create index leads_phone_idx on public.leads(user_id, phone_digits);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "Own leads or admin" on public.leads for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Phone numbers
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number text not null,
  friendly_name text, region text,
  voice boolean not null default true, sms boolean not null default true,
  is_primary boolean not null default false,
  telnyx_id text,
  created_at timestamptz not null default now()
);
grant select, update on public.phone_numbers to authenticated;
grant all on public.phone_numbers to service_role;
alter table public.phone_numbers enable row level security;
create policy "Read own numbers" on public.phone_numbers for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Update own numbers" on public.phone_numbers for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Telephony configs
create table public.telephony_configs (
  user_id uuid primary key,
  calling_mode text not null default 'webrtc' check (calling_mode in ('webrtc','bridge')),
  bridge_phone text, primary_caller_id text,
  auto_log_call boolean not null default true,
  record_calls boolean not null default false,
  telnyx_credential_id text, sip_username text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.telephony_configs to authenticated;
grant all on public.telephony_configs to service_role;
alter table public.telephony_configs enable row level security;
create policy "Own telephony config" on public.telephony_configs for all to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Call logs (server-written)
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, lead_id uuid,
  call_control_id text, outcome text, notes text,
  duration_seconds int, created_at timestamptz not null default now()
);
grant select on public.call_logs to authenticated;
grant all on public.call_logs to service_role;
alter table public.call_logs enable row level security;
create policy "Read own call logs" on public.call_logs for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- SMS (server-written)
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, lead_id uuid,
  direction text not null check (direction in ('inbound','outbound')),
  from_number text, to_number text, body text,
  status text not null default 'queued',
  telnyx_message_id text,
  created_at timestamptz not null default now()
);
grant select on public.sms_messages to authenticated;
grant all on public.sms_messages to service_role;
alter table public.sms_messages enable row level security;
create policy "Read own texts" on public.sms_messages for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Webhook events (server only)
create table public.webhook_events (
  event_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;