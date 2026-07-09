alter table public.support_actions
add column if not exists applied_at timestamptz,
add column if not exists load_at_apply integer check (load_at_apply is null or (load_at_apply >= 0 and load_at_apply <= 100)),
add column if not exists progress_at_apply integer check (progress_at_apply is null or (progress_at_apply >= 0 and progress_at_apply <= 100)),
add column if not exists outcome_status text not null default 'unknown' check (outcome_status in ('unknown', 'helped', 'ignored', 'needs_followup')),
add column if not exists outcome_note text not null default '';

create index if not exists support_actions_status_created_idx
on public.support_actions (status, created_at desc);

create index if not exists support_actions_outcome_created_idx
on public.support_actions (outcome_status, created_at desc);
