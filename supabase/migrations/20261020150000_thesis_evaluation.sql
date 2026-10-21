-- Confidential thesis evaluation panel.
-- After the Dean accepts the synopsis, the supervisor nominates three Indian, three foreign and
-- three local evaluators. The Dean sets the order in each group; the first is invited first.
-- The office records each invitation (invited / accepted / declined) and moves to the next
-- evaluator when one declines.
--
-- Highly confidential: no policy grants access to the browser keys. Only the server (service
-- role) reads and writes this table, through /api/thesis-evaluators, which shows the full record
-- to the administrator and the Dean, and only a supervisor's own nominations to that supervisor.

create table if not exists public.thesis_evaluation (
  scholar_key text primary key,
  scholar_identifier text not null,
  scholar_name text not null default '',
  supervisor_identifier text not null default '',
  supervisor_name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists thesis_evaluation_supervisor_idx
  on public.thesis_evaluation (lower(supervisor_identifier));

alter table public.thesis_evaluation enable row level security;

revoke all on public.thesis_evaluation from anon, authenticated;
