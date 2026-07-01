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

create table if not exists public.emotion_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid references public.learning_materials(id) on delete set null,
  valence double precision not null check (valence >= -1 and valence <= 1),
  arousal double precision not null check (arousal >= 0 and arousal <= 1),
  dominant_emotion text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'emotion-api',
  model_version text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.emotion_samples enable row level security;

drop policy if exists "Users can read their emotion samples" on public.emotion_samples;
create policy "Users can read their emotion samples"
on public.emotion_samples for select
to authenticated
using (user_id = auth.uid() or public.is_teacher());

drop policy if exists "Users can insert their emotion samples" on public.emotion_samples;
create policy "Users can insert their emotion samples"
on public.emotion_samples for insert
to authenticated
with check (user_id = auth.uid());

create index if not exists emotion_samples_user_captured_idx
on public.emotion_samples (user_id, captured_at desc);
