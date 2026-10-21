-- Run in the SQL editor for project vpqkcetfuawhcieljkju.
-- Lets the research office list unfinished Ph.D. forms (mobile and email)
-- without exposing the resume token. Follow-up notes stay on the draft.

alter table public.phd_drafts
  add column if not exists follow_note text not null default '';

alter table public.phd_drafts
  add column if not exists followed_at timestamptz;

create or replace function public.list_phd_drafts()
returns table (
  mobile text,
  email text,
  department text,
  step integer,
  payload jsonb,
  updated_at timestamptz,
  follow_note text,
  followed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    d.mobile,
    d.email,
    d.department,
    d.step,
    jsonb_build_object(
      'title', d.payload ->> 'title',
      'fullName', d.payload ->> 'fullName',
      'school', d.payload ->> 'school',
      'specialization', d.payload ->> 'specialization',
      'studyMode', d.payload ->> 'studyMode',
      'session', d.payload ->> 'session',
      'year', d.payload ->> 'year',
      'email', d.payload ->> 'email',
      'mobile', d.payload ->> 'mobile'
    ),
    d.updated_at,
    coalesce(d.follow_note, ''),
    d.followed_at
  from public.phd_drafts d
  order by d.updated_at desc;
$$;

create or replace function public.update_phd_draft_follow(
  p_mobile text,
  p_note text,
  p_followed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.phd_drafts
  set
    follow_note = coalesce(trim(p_note), ''),
    followed_at = case
      when p_followed then coalesce(followed_at, now())
      else null
    end
  where mobile = trim(p_mobile);
end;
$$;

create or replace function public.delete_phd_draft_office(p_mobile text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.phd_drafts where mobile = trim(p_mobile);
end;
$$;

revoke all on function public.list_phd_drafts() from public;
revoke all on function public.update_phd_draft_follow(text, text, boolean) from public;
revoke all on function public.delete_phd_draft_office(text) from public;
grant execute on function public.list_phd_drafts() to anon, authenticated;
grant execute on function public.update_phd_draft_follow(text, text, boolean) to anon, authenticated;
grant execute on function public.delete_phd_draft_office(text) to anon, authenticated;
