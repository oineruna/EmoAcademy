-- テストデータはトランザクション終了時にすべてロールバックする。
begin;
insert into auth.users (id,email,raw_user_meta_data) values
('a1111111-1111-4111-8111-111111111111','affect-teacher-a@example.invalid','{"role":"teacher"}'),
('a2222222-2222-4222-8222-222222222222','affect-teacher-b@example.invalid','{"role":"teacher"}'),
('a3333333-3333-4333-8333-333333333333','affect-student-a@example.invalid','{"role":"student"}'),
('a4444444-4444-4444-8444-444444444444','affect-student-b@example.invalid','{"role":"student"}');
insert into public.study_groups (id,owner_id,name) values
('b1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','affect-test-a'),
('b2222222-2222-4222-8222-222222222222','a2222222-2222-4222-8222-222222222222','affect-test-b');
insert into public.study_group_members(group_id,user_id) values
('b1111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333'),
('b2222222-2222-4222-8222-222222222222','a4444444-4444-4444-8444-444444444444');
insert into public.study_sessions(id,student_id) values
('c1111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333');
insert into public.learning_affect_samples(user_id,study_session_id,boredom,engagement,confusion,frustration,dominant_affect,valid_frames,model_version,captured_at)
select 'a3333333-3333-4333-8333-333333333333','c1111111-1111-4111-8111-111111111111',20,70,65,10,'engagement',16,'test',now()- (n * interval '1 minute') from generate_series(1,3) n;
insert into public.learning_affect_samples(user_id,boredom,engagement,confusion,frustration,dominant_affect,valid_frames,model_version)
values ('a4444444-4444-4444-8444-444444444444',80,10,20,30,'boredom',16,'test');

set local role authenticated;
set local request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';
do $$ begin
  if (select count(*) from public.learning_affect_samples) <> 3 then raise exception 'Student row isolation failed'; end if;
  begin
    perform public.learning_affect_report();
    raise exception 'Student RPC access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.learning_affect_samples(user_id,boredom,engagement,confusion,frustration,dominant_affect,valid_frames,model_version)
    values ('a4444444-4444-4444-8444-444444444444',1,1,1,1,'boredom',16,'test');
    raise exception 'Cross-user insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.learning_affect_samples(user_id,boredom,engagement,confusion,frustration,dominant_affect,valid_frames,model_version)
    values ('a3333333-3333-4333-8333-333333333333',101,1,1,1,'boredom',16,'test');
    raise exception 'Score constraint failed';
  exception when check_violation then null; end;
  insert into public.learning_affect_samples(user_id,boredom,engagement,confusion,frustration,dominant_affect,valid_frames,model_version)
  values ('a3333333-3333-4333-8333-333333333333',20,70,65,10,'engagement',16,'test');
end $$;

set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
do $$ declare report jsonb; begin
  if (select count(*) from public.learning_affect_samples) <> 4 then raise exception 'Teacher row scope failed'; end if;
  report := public.learning_affect_report(p_group=>'b1111111-1111-4111-8111-111111111111');
  if report->'class_average'->>'engagement' <> '70' then raise exception 'Average aggregation failed'; end if;
  if report->>'support_count' <> '1' then raise exception 'Sustained support aggregation failed'; end if;
  if jsonb_array_length(report->'latest') <> 1 then raise exception 'Latest per-student aggregation failed'; end if;
  if report->'students'->0->>'session_id' is not null then raise exception 'Latest session selection failed'; end if;
  begin
    perform public.learning_affect_report(p_group=>'b2222222-2222-4222-8222-222222222222');
    raise exception 'Unassigned group access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.learning_affect_report(p_student=>'a4444444-4444-4444-8444-444444444444');
    raise exception 'Unassigned student access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.learning_affect_samples;
    raise exception 'Anon table access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.learning_affect_report();
    raise exception 'Anon RPC access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'learning_affect RLS and report tests passed' as result;
rollback;
