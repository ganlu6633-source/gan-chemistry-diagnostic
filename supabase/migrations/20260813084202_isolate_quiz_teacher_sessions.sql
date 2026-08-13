alter table app_private.chem_app_sessions
  add column if not exists access_scope text not null default 'unified';

alter table app_private.chem_app_sessions
  drop constraint if exists chem_app_sessions_access_scope_check;
alter table app_private.chem_app_sessions
  add constraint chem_app_sessions_access_scope_check
  check (access_scope in ('unified', 'quiz_audit'));

update app_private.chem_app_sessions as session
set access_scope = code.access_scope
from app_private.chem_access_codes as code
where code.id = session.access_code_id
  and session.access_scope is distinct from code.access_scope;

create or replace function public.chem_resolve_app_session(p_token_hash text)
returns table(student_id uuid, access_role text, expires_at timestamptz, principal_name text)
language sql
security definer
set search_path = ''
as $$
  update app_private.chem_app_sessions
  set last_seen_at = now()
  where token_hash = p_token_hash
    and access_scope = 'unified'
    and revoked_at is null
    and expires_at > now()
  returning chem_app_sessions.student_id,
            chem_app_sessions.role,
            chem_app_sessions.expires_at,
            chem_app_sessions.principal_name;
$$;

create or replace function public.chem_resolve_quiz_teacher_session(p_token_hash text)
returns table(access_role text, expires_at timestamptz, principal_name text)
language sql
security definer
set search_path = ''
as $$
  update app_private.chem_app_sessions
  set last_seen_at = now()
  where token_hash = p_token_hash
    and access_scope = 'quiz_audit'
    and role = 'teacher'
    and revoked_at is null
    and expires_at > now()
  returning chem_app_sessions.role,
            chem_app_sessions.expires_at,
            chem_app_sessions.principal_name;
$$;

create or replace function public.chem_exchange_quiz_teacher_code(
  p_name text,
  p_code text,
  p_fingerprint_hash text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table(student_id uuid, access_role text, principal_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate app_private.chem_access_codes%rowtype;
  recent_failures integer;
  normalized_input text;
begin
  normalized_input := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', '', 'g'));
  if p_code !~ '^[0-9]{6}$' or char_length(normalized_input) not between 1 and 30 then
    insert into app_private.chem_login_attempts(fingerprint_hash, succeeded)
    values(p_fingerprint_hash, false);
    return;
  end if;

  select count(*) into recent_failures
  from app_private.chem_login_attempts
  where fingerprint_hash = p_fingerprint_hash
    and not succeeded
    and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 10 then return; end if;

  select * into candidate
  from app_private.chem_access_codes
  where active
    and role = 'teacher'
    and access_scope = 'quiz_audit'
    and lower(regexp_replace(btrim(coalesce(principal_name, '')), '\s+', '', 'g')) = normalized_input
  order by created_at
  limit 1;

  if candidate.id is null
     or coalesce(candidate.locked_until, '-infinity'::timestamptz) > now()
     or candidate.code_prefix <> left(p_code, 2)
     or candidate.code_hash <> extensions.crypt(p_code, candidate.code_hash) then
    if candidate.id is not null then
      update app_private.chem_access_codes
      set failed_count = failed_count + 1,
          locked_until = case
            when failed_count + 1 >= 5 then now() + interval '15 minutes'
            else locked_until
          end
      where id = candidate.id;
    end if;
    insert into app_private.chem_login_attempts(fingerprint_hash, succeeded)
    values(p_fingerprint_hash, false);
    return;
  end if;

  update app_private.chem_access_codes
  set failed_count = 0,
      locked_until = null,
      last_used_at = now()
  where id = candidate.id;
  insert into app_private.chem_login_attempts(fingerprint_hash, succeeded)
  values(p_fingerprint_hash, true);
  insert into app_private.chem_app_sessions(
    access_code_id, student_id, role, token_hash, expires_at, principal_name, access_scope
  ) values(
    candidate.id, null, 'teacher', p_token_hash, p_expires_at,
    candidate.principal_name, 'quiz_audit'
  );
  return query select null::uuid, 'teacher'::text, candidate.principal_name;
end
$$;

revoke all on function public.chem_resolve_app_session(text)
  from public, anon, authenticated;
revoke all on function public.chem_resolve_quiz_teacher_session(text)
  from public, anon, authenticated;
revoke all on function public.chem_exchange_quiz_teacher_code(text, text, text, text, timestamptz)
  from public, anon, authenticated;
