-- 既存のstudy_groupsとstudy_group_membersのRLS循環を解消する。
-- この限定的な参照判定だけを非公開schemaへ置く。呼出者の所属・所有・教師権限を必ず確認する。
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.can_read_study_group(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.study_groups g where g.id = p_group
      and (g.owner_id = auth.uid() or public.is_teacher() or exists (
        select 1 from public.study_group_members m where m.group_id=g.id and m.user_id=auth.uid()
      ))
  );
$$;
revoke all on function private.can_read_study_group(uuid) from public, anon;
grant execute on function private.can_read_study_group(uuid) to authenticated;

drop policy if exists "Users can read their groups" on public.study_groups;
create policy "Users can read their groups"
on public.study_groups for select to authenticated
using (private.can_read_study_group(id));
