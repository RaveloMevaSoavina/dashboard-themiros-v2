update public.workspaces
set declared_stage = case declared_stage
  when 'startup' then 'pre_launch'
  when 'closed' then 'post_closure'
  else declared_stage
end
where declared_stage in ('startup', 'closed');

alter table public.workspaces
  drop constraint if exists workspaces_declared_stage_check,
  add constraint workspaces_declared_stage_check check (
    declared_stage is null or declared_stage in (
      'design',
      'pre_launch',
      'implementation',
      'mid_term',
      'closing',
      'post_closure',
      'cross_cutting'
    )
  );

comment on column public.workspaces.declared_stage is
  'Declared lifecycle phase: design, pre-launch, implementation, mid-term, closing, post-closure, or cross-cutting.';
