-- DAiSEEの4指標を独立した強度として保存する。旧emotion_samplesは保持する。
create table public.learning_affect_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid references public.learning_materials(id) on delete set null,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  boredom smallint not null check (boredom between 0 and 100),
  engagement smallint not null check (engagement between 0 and 100),
  confusion smallint not null check (confusion between 0 and 100),
  frustration smallint not null check (frustration between 0 and 100),
  dominant_affect text not null check (dominant_affect in ('boredom','engagement','confusion','frustration')),
  confidence double precision check (confidence between 0 and 1),
  valid_frames smallint not null check (valid_frames between 12 and 16),
  model_version text not null,
  captured_at timestamptz not null default now()
);
create index learning_affect_user_time on public.learning_affect_samples(user_id, captured_at desc);
create index learning_affect_time on public.learning_affect_samples(captured_at desc);
alter table public.learning_affect_samples enable row level security;
revoke all on public.learning_affect_samples from anon, authenticated;
grant select, insert on public.learning_affect_samples to authenticated;
grant all on public.learning_affect_samples to service_role;
create policy "Students insert own learning affect"
on public.learning_affect_samples for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (study_session_id is null or exists (
    select 1 from public.study_sessions s where s.id = study_session_id and s.student_id = (select auth.uid())
    and s.ended_at is null and s.material_id is not distinct from learning_affect_samples.material_id
  ))
);
create policy "Students read own learning affect"
on public.learning_affect_samples for select to authenticated
using (user_id = (select auth.uid()));
create policy "Teachers read owned group learning affect"
on public.learning_affect_samples for select to authenticated
using (public.is_teacher() and exists (
  select 1 from public.study_groups g join public.study_group_members m on m.group_id = g.id
  where g.owner_id = (select auth.uid()) and m.user_id = learning_affect_samples.user_id
));

create function public.learning_affect_report(
  p_from timestamptz default now() - interval '24 hours',
  p_to timestamptz default now(),
  p_student uuid default null,
  p_material uuid default null,
  p_group uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare report jsonb;
begin
  if auth.uid() is null or not public.is_teacher() then
    raise exception 'Teacher access required' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'Invalid report time range';
  end if;
  if p_group is not null and not exists (select 1 from public.study_groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Group access denied' using errcode = '42501';
  end if;
  if p_student is not null and not exists (
    select 1 from public.study_groups g join public.study_group_members m on m.group_id=g.id
    where g.owner_id=auth.uid() and m.user_id=p_student and (p_group is null or g.id=p_group)
  ) then raise exception 'Student access denied' using errcode = '42501'; end if;
  with samples as (
    select s.* from public.learning_affect_samples s
    where s.captured_at >= p_from and s.captured_at <= p_to
      and (p_student is null or s.user_id = p_student)
      and (p_material is null or s.material_id = p_material)
      and exists (select 1 from public.study_groups g join public.study_group_members m on m.group_id=g.id
        where g.owner_id=auth.uid() and m.user_id=s.user_id and (p_group is null or g.id=p_group))
  ), latest as (
    select distinct on (user_id) * from samples order by user_id, captured_at desc, id desc
  ), student_average as (
    select s.user_id, l.study_session_id as session_id, count(*) as samples,
      jsonb_build_object('boredom',round(avg(s.boredom)),'engagement',round(avg(s.engagement)),
        'confusion',round(avg(s.confusion)),'frustration',round(avg(s.frustration))) as scores
    from samples s join latest l on l.user_id=s.user_id and s.study_session_id is not distinct from l.study_session_id
    group by s.user_id, l.study_session_id
  ), trend as (
    select date_bin(interval '5 minutes', captured_at, timestamptz '2000-01-01') as captured_at,
      round(avg(boredom)) as boredom, round(avg(engagement)) as engagement,
      round(avg(confusion)) as confusion, round(avg(frustration)) as frustration
    from samples group by 1 order by 1
  ), ranked as (
    select user_id, confusion, frustration, row_number() over (partition by user_id order by captured_at desc, id desc) as position from samples
  ), sustained as (
    select user_id from ranked where position <= 3 group by user_id
    having count(*) = 3 and (bool_and(confusion >= 60) or bool_and(frustration >= 60))
  )
  select jsonb_build_object(
    'latest',coalesce((select jsonb_agg(to_jsonb(l)) from latest l),'[]'::jsonb),
    'students',coalesce((select jsonb_agg(to_jsonb(a)) from student_average a),'[]'::jsonb),
    'trend',coalesce((select jsonb_agg(to_jsonb(t)) from trend t),'[]'::jsonb),
    'class_average',(select jsonb_build_object('boredom',round(avg((scores->>'boredom')::numeric)),
      'engagement',round(avg((scores->>'engagement')::numeric)), 'confusion',round(avg((scores->>'confusion')::numeric)),
      'frustration',round(avg((scores->>'frustration')::numeric))) from student_average having count(*) > 0),
    'support_count',(select count(*) from sustained),
    'sample_count',(select count(*) from samples)
  ) into report;
  return report;
end;
$$;
revoke all on function public.learning_affect_report(timestamptz,timestamptz,uuid,uuid,uuid) from public, anon;
grant execute on function public.learning_affect_report(timestamptz,timestamptz,uuid,uuid,uuid) to authenticated;
