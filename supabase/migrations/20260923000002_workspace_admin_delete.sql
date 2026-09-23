create or replace function public.delete_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and profile_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Only a workspace administrator can delete this workspace'
      using errcode = '42501';
  end if;

  update public.profiles
  set current_workspace_id = null
  where current_workspace_id = target_workspace_id;

  delete from public.workspaces
  where id = target_workspace_id;
end;
$$;

revoke all on function public.delete_workspace(uuid) from public;
grant execute on function public.delete_workspace(uuid) to authenticated;

comment on function public.delete_workspace(uuid) is
  'Permanently deletes a workspace when the caller is one of its administrators.';
