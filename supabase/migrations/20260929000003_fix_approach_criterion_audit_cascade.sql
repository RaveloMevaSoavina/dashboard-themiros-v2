-- Deleting a workspace or an approach cascades to approach_criteria after the
-- parent approach is no longer visible. In that case there is no durable
-- approach to attach an audit event to, and approach_events would be deleted by
-- the same cascade anyway. Skip only that cascade-generated removal event.
create or replace function public.audit_approach_criterion_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_approach public.approaches%rowtype;
  target_approach_id uuid;
  target_ref_criterion_id uuid;
  previous_value jsonb;
  next_value jsonb;
begin
  if tg_op = 'DELETE' then
    target_approach_id := old.approach_id;
    target_ref_criterion_id := old.ref_criterion_id;
    previous_value := to_jsonb(old);
    next_value := null;
  elsif tg_op = 'INSERT' then
    target_approach_id := new.approach_id;
    target_ref_criterion_id := new.ref_criterion_id;
    previous_value := null;
    next_value := to_jsonb(new);
  else
    target_approach_id := new.approach_id;
    target_ref_criterion_id := new.ref_criterion_id;
    previous_value := to_jsonb(old);
    next_value := to_jsonb(new);
  end if;

  select *
  into target_approach
  from public.approaches
  where id = target_approach_id;

  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;

    raise exception 'Approach % not found while auditing criterion change',
      target_approach_id;
  end if;

  insert into public.approach_events (
    approach_id,
    workspace_id,
    event_type,
    actor_id,
    previous_state,
    next_state,
    metadata
  )
  values (
    target_approach.id,
    target_approach.workspace_id,
    case
      when tg_op = 'INSERT' then 'criterion_added'
      when tg_op = 'DELETE' then 'criterion_removed'
      else 'criterion_modified'
    end,
    auth.uid(),
    previous_value,
    next_value,
    jsonb_build_object(
      'ref_criterion_id',
      target_ref_criterion_id
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.audit_approach_criterion_change() is
  'Audits criterion changes and safely ignores removals cascaded from a deleted approach.';
