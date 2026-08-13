alter table public.quiz_sessions
  add column if not exists assessment_key text not null default 'legacy-unscoped';

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_day_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_day_check check (day between 1 and 15);

update public.quiz_sessions session
set assessment_key = case
  when exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') like 'APPCALC-%'
  ) and not exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') not like 'APPCALC-%'
  ) then 'mole-application-v3'
  when exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') like 'GMV-%'
  ) and not exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') not like 'GMV-%'
  ) then 'gas-molar-volume-v2'
  when exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') ~ '^(MM|MN|MNN|MOL|NA)-'
  ) and not exists (
    select 1 from jsonb_array_elements(session.answers) answer
    where coalesce(answer->>'id', '') !~ '^(MM|MN|MNN|MOL|NA)-'
  ) then 'mole-basics-v1'
  else 'legacy-day-' || session.day
end
where assessment_key in ('', 'legacy-unscoped');

alter table public.quiz_sessions
  alter column assessment_key set default 'legacy-unscoped';

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_assessment_key_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_assessment_key_check
  check (assessment_key ~ '^[a-z0-9][a-z0-9-]{2,79}$');

create index if not exists quiz_sessions_student_assessment_completed_idx
  on public.quiz_sessions (student_id, assessment_key, completed_at desc);

create unique index if not exists quiz_sessions_redox_student_round_uidx
  on public.quiz_sessions (student_id, assessment_key, round)
  where assessment_key = 'redox-foundations-v1';

create table if not exists public.quiz_assessment_assignments (
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_key text not null check (assessment_key ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  active boolean not null default true,
  opens_at timestamptz not null,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, assessment_key),
  constraint quiz_assessment_assignment_window check (closes_at is null or closes_at > opens_at)
);

alter table public.quiz_assessment_assignments enable row level security;
revoke all on table public.quiz_assessment_assignments from anon, authenticated;
grant select, insert, update, delete on table public.quiz_assessment_assignments to service_role;
