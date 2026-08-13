alter table app_private.chem_access_codes
  add column if not exists access_scope text not null default 'unified';

alter table app_private.chem_access_codes
  drop constraint if exists chem_access_codes_access_scope_check;
alter table app_private.chem_access_codes
  add constraint chem_access_codes_access_scope_check
  check (access_scope in ('unified', 'quiz_audit'));

drop index if exists app_private.chem_access_codes_teacher_name_unique;
create unique index chem_access_codes_teacher_name_scope_unique
  on app_private.chem_access_codes(lower(principal_name), access_scope)
  where role = 'teacher' and active;

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

  for candidate in
    select *
    from app_private.chem_access_codes
    where active
      and role = 'teacher'
      and access_scope = 'quiz_audit'
      and code_prefix = left(p_code, 2)
      and coalesce(locked_until, '-infinity'::timestamptz) <= now()
  loop
    if lower(regexp_replace(btrim(coalesce(candidate.principal_name, '')), '\s+', '', 'g')) <> normalized_input then
      continue;
    end if;
    if candidate.code_hash <> extensions.crypt(p_code, candidate.code_hash) then
      continue;
    end if;

    update app_private.chem_access_codes
    set failed_count = 0,
        locked_until = null,
        last_used_at = now()
    where id = candidate.id;
    insert into app_private.chem_login_attempts(fingerprint_hash, succeeded)
    values(p_fingerprint_hash, true);
    insert into app_private.chem_app_sessions(
      access_code_id, student_id, role, token_hash, expires_at, principal_name
    ) values(
      candidate.id, null, 'teacher', p_token_hash, p_expires_at, candidate.principal_name
    );
    return query select null::uuid, 'teacher'::text, candidate.principal_name;
    return;
  end loop;

  insert into app_private.chem_login_attempts(fingerprint_hash, succeeded)
  values(p_fingerprint_hash, false);
end
$$;

create or replace function public.chem_rotate_quiz_teacher_access_code(p_name text, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_input text;
  teacher_code_id uuid;
begin
  normalized_input := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', '', 'g'));
  if p_code !~ '^[0-9]{6}$' or char_length(normalized_input) not between 1 and 30 then
    raise exception 'invalid quiz teacher access code request';
  end if;

  select id into teacher_code_id
  from app_private.chem_access_codes
  where role = 'teacher'
    and access_scope = 'quiz_audit'
    and lower(regexp_replace(btrim(coalesce(principal_name, '')), '\s+', '', 'g')) = normalized_input
  order by created_at
  limit 1;

  if teacher_code_id is null then
    insert into app_private.chem_access_codes(
      student_id, role, principal_name, code_hash, code_prefix, access_scope,
      active, failed_count, locked_until, rotated_at
    ) values(
      null, 'teacher', btrim(p_name), extensions.crypt(p_code, extensions.gen_salt('bf', 12)),
      left(p_code, 2), 'quiz_audit', true, 0, null, now()
    ) returning id into teacher_code_id;
  else
    update app_private.chem_access_codes
    set principal_name = btrim(p_name),
        code_hash = extensions.crypt(p_code, extensions.gen_salt('bf', 12)),
        code_prefix = left(p_code, 2),
        active = true,
        failed_count = 0,
        locked_until = null,
        rotated_at = now()
    where id = teacher_code_id;
  end if;

  update app_private.chem_app_sessions
  set revoked_at = now()
  where access_code_id = teacher_code_id and revoked_at is null;
end
$$;

revoke all on function public.chem_exchange_quiz_teacher_code(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.chem_rotate_quiz_teacher_access_code(text, text)
  from public, anon, authenticated;
