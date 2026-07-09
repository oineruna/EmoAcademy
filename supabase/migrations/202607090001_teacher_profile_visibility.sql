drop policy if exists "Teachers can read student profiles" on public.profiles;
create policy "Teachers can read student profiles"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_teacher()
);
