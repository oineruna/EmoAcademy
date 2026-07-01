create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'teacher'
  );
$$;

create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  subject text not null default 'General',
  material_type text not null default 'LINK' check (material_type in ('PDF', 'LINK', 'CARD')),
  duration_minutes integer not null default 10 check (duration_minutes > 0),
  external_url text,
  instruction text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid references public.learning_materials(id) on delete set null,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'completed')),
  percent integer not null default 0 check (percent >= 0 and percent <= 100),
  last_activity_title text not null default '',
  last_studied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, material_id)
);

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.qa_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid references public.learning_materials(id) on delete set null,
  question text not null,
  teacher_answer text,
  answered_by uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.learning_materials enable row level security;
alter table public.study_progress enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.qa_threads enable row level security;

drop policy if exists "Authenticated users can read published materials" on public.learning_materials;
create policy "Authenticated users can read published materials"
on public.learning_materials for select
to authenticated
using (is_published = true or created_by = auth.uid() or public.is_teacher());

drop policy if exists "Teachers can create materials" on public.learning_materials;
create policy "Teachers can create materials"
on public.learning_materials for insert
to authenticated
with check (created_by = auth.uid() and public.is_teacher());

drop policy if exists "Teachers can update their materials" on public.learning_materials;
create policy "Teachers can update their materials"
on public.learning_materials for update
to authenticated
using (created_by = auth.uid() or public.is_teacher())
with check (created_by = auth.uid() or public.is_teacher());

drop policy if exists "Users can read their progress" on public.study_progress;
create policy "Users can read their progress"
on public.study_progress for select
to authenticated
using (user_id = auth.uid() or public.is_teacher());

drop policy if exists "Users can create their progress" on public.study_progress;
create policy "Users can create their progress"
on public.study_progress for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their progress" on public.study_progress;
create policy "Users can update their progress"
on public.study_progress for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read their groups" on public.study_groups;
create policy "Users can read their groups"
on public.study_groups for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_teacher()
  or exists (
    select 1 from public.study_group_members
    where group_id = study_groups.id
      and user_id = auth.uid()
  )
);

drop policy if exists "Users can create groups" on public.study_groups;
create policy "Users can create groups"
on public.study_groups for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Owners can update groups" on public.study_groups;
create policy "Owners can update groups"
on public.study_groups for update
to authenticated
using (owner_id = auth.uid() or public.is_teacher())
with check (owner_id = auth.uid() or public.is_teacher());

drop policy if exists "Users can read group members" on public.study_group_members;
create policy "Users can read group members"
on public.study_group_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_teacher()
  or exists (
    select 1 from public.study_groups
    where id = study_group_members.group_id
      and owner_id = auth.uid()
  )
);

drop policy if exists "Owners can add group members" on public.study_group_members;
create policy "Owners can add group members"
on public.study_group_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_teacher()
  or exists (
    select 1 from public.study_groups
    where id = study_group_members.group_id
      and owner_id = auth.uid()
  )
);

drop policy if exists "Users can read their questions" on public.qa_threads;
create policy "Users can read their questions"
on public.qa_threads for select
to authenticated
using (user_id = auth.uid() or public.is_teacher());

drop policy if exists "Users can create questions" on public.qa_threads;
create policy "Users can create questions"
on public.qa_threads for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users and teachers can update questions" on public.qa_threads;
create policy "Users and teachers can update questions"
on public.qa_threads for update
to authenticated
using (user_id = auth.uid() or public.is_teacher())
with check (user_id = auth.uid() or public.is_teacher());

drop trigger if exists set_learning_materials_updated_at on public.learning_materials;
create trigger set_learning_materials_updated_at
  before update on public.learning_materials
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_study_progress_updated_at on public.study_progress;
create trigger set_study_progress_updated_at
  before update on public.study_progress
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_study_groups_updated_at on public.study_groups;
create trigger set_study_groups_updated_at
  before update on public.study_groups
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_qa_threads_updated_at on public.qa_threads;
create trigger set_qa_threads_updated_at
  before update on public.qa_threads
  for each row execute procedure public.set_updated_at();
