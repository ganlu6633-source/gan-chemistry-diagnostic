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

  select code.* into candidate
  from app_private.chem_access_codes as code
  where code.active
    and code.role = 'teacher'
    and code.access_scope = 'quiz_audit'
    and lower(regexp_replace(btrim(coalesce(code.principal_name, '')), '\s+', '', 'g')) = normalized_input
  order by code.created_at
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

revoke all on function public.chem_exchange_quiz_teacher_code(text, text, text, text, timestamptz)
  from public, anon, authenticated;
