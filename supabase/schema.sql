-- Hausilo database.
-- How to use: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- It is safe to run again later; it only adds what is missing.
--
-- After you sign up on hausilo.com with your own email, make yourself the admin by running:
--     select public.make_admin('you@example.com');

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;      -- no policies: nobody reads this table from the site
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Run from the SQL Editor only. The site itself cannot call it.
create or replace function public.make_admin(admin_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(admin_email));
  if uid is null then
    return 'No account with that email yet. Sign up on the site first, then run this again.';
  end if;
  insert into public.admins (user_id) values (uid) on conflict do nothing;
  return 'Done. ' || admin_email || ' is now an admin.';
end $$;
revoke execute on function public.make_admin(text) from public, anon, authenticated;

-- Run from the SQL Editor only. Until the site can send password-reset emails, this is how to help a member
-- who is locked out: give them a temporary password, and ask them to change it on their account page.
create or replace function public.set_password(member_email text, new_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if char_length(new_password) < 8 then
    return 'Pick a password of at least 8 characters.';
  end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(member_email));
  if uid is null then
    return 'No account with that email.';
  end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) where id = uid;
  return 'Done. ' || member_email || ' can sign in with the new password.';
end $$;
revoke execute on function public.set_password(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- people
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'investor' check (role in ('investor','wholesaler','owner')),
  name       text not null default '' check (char_length(name) <= 80),
  phone      text not null default '' check (char_length(phone) <= 30),
  company    text not null default '' check (char_length(company) <= 80),
  email      text not null default '' check (char_length(email) <= 200),
  seen_at    timestamptz not null default now(),     -- last time they looked at their matches
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Every new account gets a profile row from what they typed on the sign-up form.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.profiles (id, role, name, phone, company, email)
    values (
      new.id,
      case when new.raw_user_meta_data->>'role' in ('investor','wholesaler','owner') then new.raw_user_meta_data->>'role' else 'investor' end,
      left(coalesce(new.raw_user_meta_data->>'name', ''), 80),
      left(coalesce(new.raw_user_meta_data->>'phone', ''), 30),
      left(coalesce(new.raw_user_meta_data->>'company', ''), 80),
      left(coalesce(new.email, ''), 200)
    ) on conflict (id) do nothing;
  exception when others then null;      -- never block a sign-up over the profile row
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- deals
-- Public part of a deal. Anyone can see these columns once the deal is live.
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','active','under_contract','sold','rejected','removed')),
  seller_type   text not null default 'wholesaler' check (seller_type in ('wholesaler','owner')),
  zip           text not null check (zip ~ '^[0-9]{5}$'),
  area          text not null default '' check (char_length(area) <= 60),
  lat           double precision check (lat between -90 and 90),      -- rounded, so the pin is only roughly right
  lng           double precision check (lng between -180 and 180),
  property_type text not null default 'House' check (property_type in ('House','Duplex','Triplex/Quad','Townhome','Condo','Lot')),
  beds          smallint not null default 0 check (beds between 0 and 20),
  baths         numeric(3,1) not null default 0 check (baths between 0 and 20),
  sqft          integer not null check (sqft between 100 and 50000),
  year_built    smallint check (year_built between 1800 and 2100),
  condition     smallint not null default 3 check (condition between 1 and 5),
  asking        integer not null check (asking between 1000 and 100000000),
  arv           integer not null check (arv between 1000 and 100000000),
  repairs       integer not null default 0 check (repairs between 0 and 100000000),
  rent          integer check (rent between 0 and 1000000),
  occupancy     text not null default 'vacant' check (occupancy in ('vacant','owner','tenant')),
  close_by      date,
  emd           integer check (emd between 0 and 10000000),
  headline      text not null default '' check (char_length(headline) <= 90),
  notes         text not null default '' check (char_length(notes) <= 3000),
  comps         jsonb not null default '[]'::jsonb check (jsonb_typeof(comps) = 'array' and jsonb_array_length(comps) <= 6),
  photos        text[] not null default '{}' check (cardinality(photos) <= 8),
  verified      boolean not null default false,       -- Hausilo has seen proof of the contract or deed
  featured      boolean not null default false,
  reject_reason text not null default '' check (char_length(reject_reason) <= 300),
  private_rev   integer not null default 0,           -- bumped when the private details change
  disclosure_ack_at timestamptz,                      -- when the poster accepted the Texas disclosure
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists listings_status_idx on public.listings (status, published_at desc);
create index if not exists listings_owner_idx on public.listings (owner_id);

-- Keeps posters from approving, verifying or featuring their own deals, and sends edited deals back to review.
create or replace function public.listings_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  admin boolean := public.is_admin();
  me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if not admin then
      new.owner_id := me; new.status := 'pending'; new.verified := false; new.featured := false;
      new.reject_reason := ''; new.published_at := null; new.private_rev := 0;
      if (select count(*) from public.listings l where l.owner_id = me and l.status in ('pending','active','under_contract')) >= 20 then
        raise exception 'You have 20 open deals. Close or remove one before posting another.';
      end if;
    end if;
    if new.disclosure_ack_at is null then
      raise exception 'Accept the disclosure before posting.';
    end if;
    new.created_at := now(); new.updated_at := now();
    if new.status = 'active' and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;

  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at; new.updated_at := now();
  if admin then
    if new.status = 'active' and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;

  new.verified := old.verified; new.featured := old.featured;
  new.reject_reason := old.reject_reason; new.published_at := old.published_at;
  if new.status is distinct from old.status and not (
       (old.status in ('active','under_contract') and new.status in ('active','under_contract','sold','removed'))
    or (old.status = 'pending' and new.status = 'removed')
    or (old.status in ('rejected','removed') and new.status = 'pending')
    or (old.status = 'rejected' and new.status = 'removed')
    or (old.status = 'sold' and new.status = 'removed')) then
    raise exception 'That change needs a review by Hausilo first.';
  end if;
  -- Changing what people see sends a live deal back to review. Price changes do not.
  if old.status in ('active','under_contract') and new.status in ('active','under_contract')
     and (new.headline, new.notes, new.photos, new.zip, new.area, new.seller_type, new.property_type, new.private_rev)
         is distinct from
         (old.headline, old.notes, old.photos, old.zip, old.area, old.seller_type, old.property_type, old.private_rev) then
    new.status := 'pending'; new.verified := false;
  end if;
  return new;
end $$;
drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

alter table public.listings enable row level security;
drop policy if exists "listings: anyone sees live deals" on public.listings;
create policy "listings: anyone sees live deals" on public.listings for select to anon, authenticated
  using (status in ('active','under_contract','sold') or owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "listings: members post their own" on public.listings;
create policy "listings: members post their own" on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "listings: owner or admin edits" on public.listings;
create policy "listings: owner or admin edits" on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "listings: owner or admin deletes" on public.listings;
create policy "listings: owner or admin deletes" on public.listings for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

-- Private part of a deal: street address and how to reach the seller. Only signed-in members see it.
create table if not exists public.listing_private (
  listing_id    uuid primary key references public.listings(id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  street        text not null check (char_length(street) between 3 and 140),
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),
  contact_name  text not null check (char_length(contact_name) between 2 and 80),
  contact_phone text not null default '' check (char_length(contact_phone) <= 30),
  contact_email text not null default '' check (char_length(contact_email) <= 200),
  access_notes  text not null default '' check (char_length(access_notes) <= 500)
);
create or replace function public.listing_private_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.listing_id := old.listing_id; new.owner_id := old.owner_id;
    if new.street is distinct from old.street and not public.is_admin() then
      update public.listings set private_rev = private_rev + 1 where id = new.listing_id;
    end if;
  elsif not public.is_admin() then
    new.owner_id := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists listing_private_guard on public.listing_private;
create trigger listing_private_guard before insert or update on public.listing_private
  for each row execute function public.listing_private_guard();

alter table public.listing_private enable row level security;
drop policy if exists "private: members see live deals, owners see their own" on public.listing_private;
create policy "private: members see live deals, owners see their own" on public.listing_private for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin())
      or exists (select 1 from public.listings l where l.id = listing_id and l.status in ('active','under_contract')));
drop policy if exists "private: owner adds" on public.listing_private;
create policy "private: owner adds" on public.listing_private for insert to authenticated
  with check ((select public.is_admin()) or (owner_id = (select auth.uid())
      and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))));
drop policy if exists "private: owner or admin edits" on public.listing_private;
create policy "private: owner or admin edits" on public.listing_private for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "private: owner or admin deletes" on public.listing_private;
create policy "private: owner or admin deletes" on public.listing_private for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.listing_private from anon, authenticated;
grant select, insert, update, delete on public.listing_private to authenticated;

-- ---------------------------------------------------------------- buy boxes
create table if not exists public.buy_boxes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label        text not null default 'My buy box' check (char_length(label) <= 60),
  zips         text[] not null default '{}' check (cardinality(zips) <= 80),
  min_price    integer not null default 0 check (min_price >= 0),
  max_price    integer not null default 0 check (max_price >= 0),      -- 0 means no limit
  min_beds     smallint not null default 0 check (min_beds between 0 and 20),
  types        text[] not null default '{}' check (cardinality(types) <= 6),
  strategy     text not null default 'both' check (strategy in ('flip','rent','both')),
  min_profit   integer not null default 0,
  min_cashflow integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists buy_boxes_user_idx on public.buy_boxes (user_id);
create or replace function public.buy_boxes_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.user_id := auth.uid(); end if;
    if (select count(*) from public.buy_boxes b where b.user_id = new.user_id) >= 5 then
      raise exception 'You can keep up to 5 buy boxes.';
    end if;
  else
    new.id := old.id; new.user_id := old.user_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists buy_boxes_guard on public.buy_boxes;
create trigger buy_boxes_guard before insert or update on public.buy_boxes
  for each row execute function public.buy_boxes_guard();
alter table public.buy_boxes enable row level security;
drop policy if exists "buy boxes: own, admin reads" on public.buy_boxes;
create policy "buy boxes: own, admin reads" on public.buy_boxes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "buy boxes: add own" on public.buy_boxes;
create policy "buy boxes: add own" on public.buy_boxes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "buy boxes: edit own" on public.buy_boxes;
create policy "buy boxes: edit own" on public.buy_boxes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "buy boxes: delete own" on public.buy_boxes;
create policy "buy boxes: delete own" on public.buy_boxes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.buy_boxes from anon, authenticated;
grant select, insert, update, delete on public.buy_boxes to authenticated;

-- How many buyers want a zip at a price. Counts only, never who.
create or replace function public.buyer_count(p_zip text, p_price integer) returns integer
language sql stable security definer set search_path = '' as $$
  select count(distinct b.user_id)::int from public.buy_boxes b
  where b.active
    and (cardinality(b.zips) = 0 or p_zip = any (b.zips))
    and (coalesce(p_price, 0) <= 0 or ((b.max_price = 0 or p_price <= b.max_price) and p_price >= b.min_price));
$$;
create or replace function public.zip_demand() returns table (zip text, buyers integer)
language sql stable security definer set search_path = '' as $$
  select z.zip, count(distinct b.user_id)::int from public.buy_boxes b cross join lateral unnest(b.zips) as z(zip)
  where b.active group by z.zip
  union all
  select '*', count(distinct b.user_id)::int from public.buy_boxes b where b.active and cardinality(b.zips) = 0;
$$;
grant execute on function public.buyer_count(text, integer) to anon, authenticated;
grant execute on function public.zip_demand() to anon, authenticated;

-- ---------------------------------------------------------------- interest, saves, reports
create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  from_user  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  phone      text not null default '' check (char_length(phone) <= 30),
  email      text not null default '' check (char_length(email) <= 200),
  message    text not null default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, from_user)
);
create index if not exists inquiries_listing_idx on public.inquiries (listing_id);
alter table public.inquiries enable row level security;
drop policy if exists "inquiries: sender, deal owner, admin read" on public.inquiries;
create policy "inquiries: sender, deal owner, admin read" on public.inquiries for select to authenticated
  using (from_user = (select auth.uid()) or (select public.is_admin())
      or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));
drop policy if exists "inquiries: members ask about live deals" on public.inquiries;
create policy "inquiries: members ask about live deals" on public.inquiries for insert to authenticated
  with check (from_user = (select auth.uid())
      and exists (select 1 from public.listings l where l.id = listing_id and l.status in ('active','under_contract') and l.owner_id <> (select auth.uid())));
drop policy if exists "inquiries: sender edits" on public.inquiries;
create policy "inquiries: sender edits" on public.inquiries for update to authenticated
  using (from_user = (select auth.uid())) with check (from_user = (select auth.uid()));
drop policy if exists "inquiries: sender or admin deletes" on public.inquiries;
create policy "inquiries: sender or admin deletes" on public.inquiries for delete to authenticated
  using (from_user = (select auth.uid()) or (select public.is_admin()));
revoke all on public.inquiries from anon, authenticated;
grant select, insert, update, delete on public.inquiries to authenticated;

create or replace function public.interest_counts() returns table (listing_id uuid, investors integer)
language sql stable security definer set search_path = '' as $$
  select i.listing_id, count(*)::int from public.inquiries i
  join public.listings l on l.id = i.listing_id and l.status in ('active','under_contract')
  group by i.listing_id;
$$;
grant execute on function public.interest_counts() to anon, authenticated;

create table if not exists public.saves (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.saves enable row level security;
drop policy if exists "saves: own" on public.saves;
create policy "saves: own" on public.saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.saves from anon, authenticated;
grant select, insert, delete on public.saves to authenticated;

create table if not exists public.reports (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  from_user  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (listing_id, from_user)
);
alter table public.reports enable row level security;
drop policy if exists "reports: members flag" on public.reports;
create policy "reports: members flag" on public.reports for insert to authenticated with check (from_user = (select auth.uid()));
drop policy if exists "reports: admin reads" on public.reports;
create policy "reports: admin reads" on public.reports for select to authenticated using ((select public.is_admin()));
drop policy if exists "reports: admin clears" on public.reports;
create policy "reports: admin clears" on public.reports for delete to authenticated using ((select public.is_admin()));
revoke all on public.reports from anon, authenticated;
grant select, insert, delete on public.reports to authenticated;

-- ---------------------------------------------------------------- homeowners asking for an offer
create table if not exists public.seller_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null check (char_length(name) between 2 and 80),
  contact       text not null check (char_length(contact) between 5 and 120),
  street        text not null check (char_length(street) between 3 and 140),
  zip           text not null check (zip ~ '^[0-9]{5}$'),
  property_type text not null default 'House' check (char_length(property_type) <= 20),
  beds          smallint check (beds between 0 and 20),
  baths         numeric(3,1) check (baths between 0 and 20),
  sqft          integer check (sqft between 0 and 50000),
  year_built    smallint check (year_built between 1800 and 2100),
  condition     smallint check (condition between 1 and 5),
  est_value     integer check (est_value between 0 and 100000000),
  owe           integer not null default 0 check (owe between 0 and 100000000),
  timeline      text not null default '' check (char_length(timeline) <= 40),
  reason        text not null default '' check (char_length(reason) <= 60),
  notes         text not null default '' check (char_length(notes) <= 1000),
  status        text not null default 'new' check (status in ('new','contacted','offer_made','closed','not_a_fit')),
  admin_notes   text not null default '' check (char_length(admin_notes) <= 2000),
  created_at    timestamptz not null default now()
);
create index if not exists seller_requests_created_idx on public.seller_requests (created_at desc);
-- Anyone may send a request without an account, so this keeps spam bursts out.
create or replace function public.seller_requests_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'new'; new.admin_notes := ''; new.created_at := now(); new.user_id := auth.uid();
  if (select count(*) from public.seller_requests r where r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many requests right now. Try again in an hour, or email hello@hausilo.com.';
  end if;
  if (select count(*) from public.seller_requests r where lower(r.contact) = lower(new.contact) and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'We already have your request and will be in touch.';
  end if;
  return new;
end $$;
drop trigger if exists seller_requests_guard on public.seller_requests;
create trigger seller_requests_guard before insert on public.seller_requests
  for each row execute function public.seller_requests_guard();
alter table public.seller_requests enable row level security;
drop policy if exists "seller requests: anyone sends" on public.seller_requests;
create policy "seller requests: anyone sends" on public.seller_requests for insert to anon, authenticated with check (true);
drop policy if exists "seller requests: own or admin reads" on public.seller_requests;
create policy "seller requests: own or admin reads" on public.seller_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "seller requests: admin updates" on public.seller_requests;
create policy "seller requests: admin updates" on public.seller_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "seller requests: admin deletes" on public.seller_requests;
create policy "seller requests: admin deletes" on public.seller_requests for delete to authenticated using ((select public.is_admin()));
revoke all on public.seller_requests from anon, authenticated;
grant insert on public.seller_requests to anon, authenticated;
grant select, update, delete on public.seller_requests to authenticated;

-- ---------------------------------------------------------------- small public numbers for the home page
create or replace function public.site_stats() returns table (deals integer, buyers integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.listings where status in ('active','under_contract')),
         (select count(distinct user_id)::int from public.buy_boxes where active);
$$;
grant execute on function public.site_stats() to anon, authenticated;

-- ---------------------------------------------------------------- closing an account
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hausilo photos: members upload to their own folder" on storage.objects;
create policy "hausilo photos: members upload to their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "hausilo photos: members see their own files" on storage.objects;
create policy "hausilo photos: members see their own files" on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists "hausilo photos: members delete their own files" on storage.objects;
create policy "hausilo photos: members delete their own files" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
