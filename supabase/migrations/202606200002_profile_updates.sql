drop policy if exists "Users can update their profile" on public.profiles;

create policy "Users can update their profile"
on public.profiles for update
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and role in ('student', 'teacher')
);
