\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','alice@a.com'),
 ('00000000-0000-0000-0000-00000000000b','bob@b.com'),
 ('00000000-0000-0000-0000-00000000000c','carol@a.com');

-- Alice creates org A, Bob creates org B
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select slug from public.create_organization('Org A','org-a','en','alice@a.com');
insert into public.events (org_id, slug, title_en, starts_at, ends_at, capacity, status, online_url)
  select id, 'launch', 'Launch', now()+interval '1 day', now()+interval '1 day 2 hours', 3, 'published', 'https://zoom.us/x' from organizations where slug='org-a';
insert into public.form_fields (event_id, org_id, type, label_en, required)
  select e.id, e.org_id, 'short_text', 'Company', true from events e;
-- guard: cannot set seats_taken directly
do $$ begin
  update public.events set seats_taken = 2;
  raise exception 'FAIL seats guard';
exception when insufficient_privilege then raise notice 'ok seats_taken guarded'; end $$;
-- guard: admin cannot unsuspend own org
do $$ begin
  update public.organizations set status='suspended';
  raise exception 'FAIL status guard';
exception when insufficient_privilege then raise notice 'ok status guarded'; end $$;
-- invite carol as staff
insert into public.invitations (org_id, email, role) select id, 'carol@a.com', 'staff' from organizations where slug='org-a';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select slug from public.create_organization('Org B','org-b','id',null);
-- Bob must not see org A or its events
select 'bob sees orgs' as t, count(*) from organizations;
select 'bob sees events' as t, count(*) from events;
do $$ begin
  insert into public.events (org_id, slug, title_en, starts_at, ends_at, capacity)
    select id, 'x','x', now(), now()+interval '1h', 10 from organizations where slug='org-a';
  if (select count(*) from organizations) = 1 then raise notice 'ok bob cannot even select org-a for insert'; end if;
end $$;
-- reserved slug
do $$ begin
  perform public.create_organization('Bad','dashboard','id',null);
  raise exception 'FAIL reserved slug';
exception when check_violation then raise notice 'ok reserved slug rejected'; end $$;
-- registration function is not callable by authenticated
do $$ begin
  perform public.register_for_event(gen_random_uuid(),'x','x@x.com','en','{}','code',true);
  raise exception 'FAIL register exec';
exception when insufficient_privilege then raise notice 'ok register_for_event locked to service role'; end $$;
reset role;

-- Registrations as service role
set role service_role;
select * from public.register_for_event((select id from events where slug='launch'),'R1','r1@x.com','en','{}','code-1',true);
select * from public.register_for_event((select id from events where slug='launch'),'R1 again','R1@X.com','en','{}','code-1b',true);
select * from public.register_for_event((select id from events where slug='launch'),'R2','r2@x.com','id','{}','code-2',false);
select * from public.register_for_event((select id from events where slug='launch'),'R2','r2@x.com','id','{}','code-2',true);
select * from public.register_for_event((select id from events where slug='launch'),'R3','r3@x.com','id','{}','code-3',true);
select * from public.register_for_event((select id from events where slug='launch'),'R4','r4@x.com','id','{}','code-4',true);
select seats_taken, capacity from events where slug='launch';
select count(*) as queued_emails from email_jobs;
select count(*) as claimed from public.claim_email_jobs(10, null);
select count(*) as claimed_again from public.claim_email_jobs(10, null);
reset role;

-- Carol accepts invite, checks in
select token as inv_token from invitations limit 1 \gset
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.accept_invitation(:'inv_token') is not null as accepted;
select result, full_name from public.check_in_ticket((select id from events where slug='launch'),'code-1','scan');
select result, full_name, checked_in_by_name from public.check_in_ticket((select id from events where slug='launch'),'code-1','scan');
select result from public.check_in_ticket((select id from events where slug='launch'),'nope','scan');
-- staff can't undo or cancel
do $$ begin perform public.undo_check_in((select id from registrations where ticket_code='code-1'));
  raise exception 'FAIL staff undo'; exception when insufficient_privilege then raise notice 'ok staff cannot undo'; end $$;
-- staff cannot update registrations
update registrations set full_name='hack' where ticket_code='code-2';
select full_name from registrations where ticket_code='code-2';
select * from public.event_stats((select id from events where slug='launch'));

-- Alice (admin) cancels code-3 -> seat freed; edit email ok; status edit blocked
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.cancel_registration((select id from registrations where ticket_code='code-3'));
select seats_taken from events where slug='launch';
update registrations set email='new@x.com' where ticket_code='code-2';
do $$ begin update registrations set status='registered' where ticket_code='code-3';
  raise exception 'FAIL status edit'; exception when insufficient_privilege then raise notice 'ok status edit blocked'; end $$;
select result from public.check_in_ticket((select id from events where slug='launch'),'code-3','scan');
select public.undo_check_in((select id from registrations where ticket_code='code-1'));
select checked_in_at is null as undone from registrations where ticket_code='code-1';
-- slug locked after publish
do $$ begin update events set slug='new-slug' where slug='launch';
  raise exception 'FAIL slug'; exception when raise_exception then raise notice 'ok slug locked'; end $$;
reset role;

-- Waitlist: event with 1 seat and waitlist on.
insert into public.events (org_id, slug, title_en, starts_at, ends_at, capacity, status, waitlist_enabled)
  select id, 'wl', 'Waitlist', now()+interval '1 day', now()+interval '1 day 2 hours', 1, 'published', true from organizations where slug='org-a';
set role service_role;
select * from public.register_for_event((select id from events where slug='wl'),'W1','w1@x.com','en','{}','wl-1',true);
select * from public.register_for_event((select id from events where slug='wl'),'W2','w2@x.com','en','{}','wl-2',true);
select * from public.register_for_event((select id from events where slug='wl'),'W3','w3@x.com','en','{}','wl-3',true);
select * from public.register_for_event((select id from events where slug='wl'),'W2 again','w2@x.com','en','{}','wl-2b',true);
reset role;
do $$ begin
  if (select status from registrations where ticket_code='wl-1') <> 'registered' then raise exception 'FAIL wl-1 should have a seat'; end if;
  if (select status from registrations where ticket_code='wl-2') <> 'waitlisted' then raise exception 'FAIL wl-2 should wait'; end if;
  if exists (select 1 from registrations where ticket_code='wl-2b') then raise exception 'FAIL duplicate waitlist entry'; end if;
  if (select seats_taken from events where slug='wl') <> 1 then raise exception 'FAIL waitlist must not take seats'; end if;
  if (select count(*) from email_jobs j join registrations r on r.id=j.registration_id where r.ticket_code in ('wl-2','wl-3') and j.kind='waitlist') <> 2
    then raise exception 'FAIL waitlist emails'; end if;
  raise notice 'ok waitlist fills when full';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select result from public.check_in_ticket((select id from events where slug='wl'),'wl-2','scan');
-- Cancel the seat holder -> first in line (W2) gets the seat automatically.
select public.cancel_registration((select id from registrations where ticket_code='wl-1'));
-- Raise capacity -> next in line (W3) gets a seat too.
update events set capacity = 2 where slug='wl';
reset role;
do $$ begin
  if (select status from registrations where ticket_code='wl-2') <> 'registered' then raise exception 'FAIL wl-2 not promoted after cancel'; end if;
  if (select status from registrations where ticket_code='wl-3') <> 'registered' then raise exception 'FAIL wl-3 not promoted after capacity increase'; end if;
  if (select seats_taken from events where slug='wl') <> 2 then raise exception 'FAIL seats after promotion'; end if;
  if (select count(*) from email_jobs j join registrations r on r.id=j.registration_id where r.ticket_code in ('wl-2','wl-3') and j.kind='ticket') <> 2
    then raise exception 'FAIL tickets not queued for promoted people'; end if;
  raise notice 'ok waitlist promotion';
end $$;
