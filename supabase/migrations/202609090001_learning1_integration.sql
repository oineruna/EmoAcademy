create table if not exists public.material_assignments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.learning_materials(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'opened', 'submitted', 'completed')),
  assigned_at timestamptz not null default now(),
  opened_at timestamptz,
  due_at timestamptz,
  unique (material_id, student_id)
);

create table if not exists public.material_submissions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.learning_materials(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null,
  is_correct boolean,
  teacher_feedback text,
  graded_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid references public.learning_materials(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.material_assignments enable row level security;
alter table public.material_submissions enable row level security;
alter table public.study_sessions enable row level security;

grant select, insert, update on public.material_assignments to authenticated;
grant select, insert, update on public.material_submissions to authenticated;
grant select, insert, update on public.study_sessions to authenticated;

drop policy if exists "Students and teachers can read assignments" on public.material_assignments;
create policy "Students and teachers can read assignments"
on public.material_assignments for select
to authenticated
using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_teacher());

drop policy if exists "Teachers can create assignments" on public.material_assignments;
create policy "Teachers can create assignments"
on public.material_assignments for insert
to authenticated
with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists "Students and teachers can update assignments" on public.material_assignments;
create policy "Students and teachers can update assignments"
on public.material_assignments for update
to authenticated
using (student_id = auth.uid() or teacher_id = auth.uid() or public.is_teacher())
with check (student_id = auth.uid() or teacher_id = auth.uid() or public.is_teacher());

drop policy if exists "Students and teachers can read submissions" on public.material_submissions;
create policy "Students and teachers can read submissions"
on public.material_submissions for select
to authenticated
using (student_id = auth.uid() or public.is_teacher());

drop policy if exists "Students can create submissions" on public.material_submissions;
create policy "Students can create submissions"
on public.material_submissions for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can grade submissions" on public.material_submissions;
create policy "Teachers can grade submissions"
on public.material_submissions for update
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

drop policy if exists "Students and teachers can read study sessions" on public.study_sessions;
create policy "Students and teachers can read study sessions"
on public.study_sessions for select
to authenticated
using (student_id = auth.uid() or public.is_teacher());

drop policy if exists "Students can create study sessions" on public.study_sessions;
create policy "Students can create study sessions"
on public.study_sessions for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Students can close their study sessions" on public.study_sessions;
create policy "Students can close their study sessions"
on public.study_sessions for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create index if not exists material_assignments_student_idx
on public.material_assignments (student_id, assigned_at desc);

create index if not exists material_submissions_student_idx
on public.material_submissions (student_id, submitted_at desc);

create index if not exists material_submissions_material_idx
on public.material_submissions (material_id, submitted_at desc);

create index if not exists study_sessions_student_idx
on public.study_sessions (student_id, started_at desc);
