create table if not exists public.support_actions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (action_type in ('break', 'split', 'check')),
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'dismissed')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.support_actions enable row level security;

grant select, insert, update on public.support_actions to authenticated;

drop policy if exists "Students and teachers can read support actions" on public.support_actions;
create policy "Students and teachers can read support actions"
on public.support_actions for select
to authenticated
using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_teacher());

drop policy if exists "Teachers can create support actions" on public.support_actions;
create policy "Teachers can create support actions"
on public.support_actions for insert
to authenticated
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists "Students can update their support actions" on public.support_actions;
create policy "Students can update their support actions"
on public.support_actions for update
to authenticated
using (student_id = auth.uid() or public.is_teacher())
with check (student_id = auth.uid() or public.is_teacher());

create index if not exists support_actions_student_created_idx
on public.support_actions (student_id, created_at desc);

create index if not exists support_actions_teacher_created_idx
on public.support_actions (teacher_id, created_at desc);
