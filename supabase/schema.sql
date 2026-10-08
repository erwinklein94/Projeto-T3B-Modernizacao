-- Projeto T3B: execute once against ixzvvyslbsuwnyhrxqwf.
begin;
create schema if not exists t3b_private;
revoke all on schema t3b_private from public, anon;
grant usage on schema t3b_private to authenticated;

create table public.t3b_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null check (role in ('editor','coordenador','analista','consulta')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.t3b_profiles enable row level security;
revoke all on public.t3b_profiles from anon, authenticated;

create function t3b_private.current_role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.t3b_profiles p where p.id=auth.uid() and p.active and auth.uid() is not null
$$;
revoke all on function t3b_private.current_role() from public,anon;
grant execute on function t3b_private.current_role() to authenticated;
create policy profile_read on public.t3b_profiles for select to authenticated using(id=(select auth.uid()) or (select t3b_private.current_role())='editor');
grant select on public.t3b_profiles to authenticated;
grant all on public.t3b_profiles to service_role;

create table public.t3b_records (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('recebimentos','movimentacoes','danificados','devolucoes','conciliacao','consumo','transferencias','madeiras','semanal','apuracoes','parametros')),
 cells jsonb not null check(jsonb_typeof(cells)='array'),
 source_key text unique,
 source_file text, source_sheet text, source_row integer,
 parent_id uuid references public.t3b_records(id),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index t3b_records_kind_idx on public.t3b_records(kind) where deleted_at is null;
create unique index t3b_records_parent_idx on public.t3b_records(parent_id) where parent_id is not null;
alter table public.t3b_records enable row level security;
revoke all on public.t3b_records from anon, authenticated;
create policy records_read on public.t3b_records for select to authenticated using((select t3b_private.current_role()) in ('editor','coordenador','analista'));
create policy records_insert on public.t3b_records for insert to authenticated with check((select t3b_private.current_role()) in ('editor','coordenador','analista') and source_key is null and parent_id is null);
create policy records_update on public.t3b_records for update to authenticated using((select t3b_private.current_role()) in ('editor','coordenador','analista') and parent_id is null) with check((select t3b_private.current_role()) in ('editor','coordenador','analista') and parent_id is null);
grant select on public.t3b_records to authenticated;
grant insert(kind,cells) on public.t3b_records to authenticated;
grant update(cells,kind,revision,deleted_at) on public.t3b_records to authenticated;
grant all on public.t3b_records to service_role;

create table public.t3b_audit (
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default now(),
 actor_id uuid, email text not null, role text not null,
 action text not null, details jsonb not null default '{}'
);
create index t3b_audit_time_idx on public.t3b_audit(occurred_at desc);
alter table public.t3b_audit enable row level security;
revoke all on public.t3b_audit from anon, authenticated;
create policy audit_editor on public.t3b_audit for select to authenticated using((select t3b_private.current_role())='editor');
grant select on public.t3b_audit to authenticated;
grant all on public.t3b_audit to service_role;

create table public.t3b_source_archive (
 source_key text primary key,
 file_name text not null,
 sheet_name text not null,
 cells jsonb not null,
 imported_at timestamptz not null default now()
);
alter table public.t3b_source_archive enable row level security;
revoke all on public.t3b_source_archive from anon, authenticated;
create policy archive_editor on public.t3b_source_archive for select to authenticated using((select t3b_private.current_role())='editor');
grant select on public.t3b_source_archive to authenticated;
grant all on public.t3b_source_archive to service_role;

create function t3b_private.provision_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_app_meta_data->>'t3b_role' in ('editor','coordenador','analista','consulta') then
  insert into public.t3b_profiles(id,email,role) values(new.id,new.email,new.raw_app_meta_data->>'t3b_role');
 end if;
 return new;
end;$$;
revoke all on function t3b_private.provision_profile() from public,anon,authenticated;
create trigger t3b_auth_profile after insert on auth.users for each row execute function t3b_private.provision_profile();

create function t3b_private.audit_login() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.t3b_audit(actor_id,email,role,action,details)
 select p.id,p.email,p.role,'login',jsonb_build_object('session_id',new.id)
 from public.t3b_profiles p where p.id=new.user_id and p.active and p.role<>'editor';
 return new;
end;$$;
revoke all on function t3b_private.audit_login() from public,anon,authenticated;
create trigger t3b_session_login after insert on auth.sessions for each row execute function t3b_private.audit_login();

create function t3b_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.t3b_profiles;
begin
 if auth.uid() is null then return new; end if;
 select * into p from public.t3b_profiles where id=auth.uid() and active;
 if p.role is not null and p.role<>'editor' then
  insert into public.t3b_audit(actor_id,email,role,action,details) values(p.id,p.email,p.role,
    case when TG_OP='INSERT' then 'create_record' when new.deleted_at is not null and old.deleted_at is null then 'delete_record' else 'update_record' end,
    jsonb_build_object('record_id',new.id,'kind',new.kind,'before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 end if;
 return new;
end;$$;
revoke all on function t3b_private.audit_record() from public,anon,authenticated;
create trigger t3b_record_audit after insert or update on public.t3b_records for each row execute function t3b_private.audit_record();

create function t3b_private.validate_record() returns trigger language plpgsql set search_path='' as $$
declare expected integer; i integer; required integer[]; numeric_fields integer[];
begin
 expected:=case new.kind when 'recebimentos' then 19 when 'movimentacoes' then 19 when 'danificados' then 21 when 'devolucoes' then 21 when 'conciliacao' then 17 when 'consumo' then 13 when 'transferencias' then 19 when 'madeiras' then 11 when 'semanal' then 6 when 'apuracoes' then 3 when 'parametros' then 14 end;
 if jsonb_array_length(new.cells)<>expected then raise exception 'Número de colunas incompatível com a planilha';end if;
 if TG_OP='UPDATE' then
  if new.kind<>old.kind then raise exception 'Não é permitido mudar o tipo de registro';end if;
  if new.revision<>old.revision+1 then raise exception 'Conflito de versão. Atualize o registro.';end if;
 end if;
 -- Imports retain legacy values. New user input must satisfy operational constraints.
 if new.source_key is null and new.parent_id is null then
  required:=case new.kind when 'recebimentos' then array[1,2,3,4,8,9] when 'movimentacoes' then array[0,1,2,5] when 'danificados' then array[1,2,9] else array[]::integer[] end;
  foreach i in array required loop
   if coalesce(trim(new.cells->>i),'')='' then raise exception 'Campo obrigatório ausente na coluna %',i+1;end if;
  end loop;
  numeric_fields:=case new.kind when 'recebimentos' then array[9,10,11,17] when 'movimentacoes' then array[6,7,8,9] when 'danificados' then array[9,10,15] else array[]::integer[] end;
  foreach i in array numeric_fields loop
   if new.cells->i<>'null'::jsonb and (jsonb_typeof(new.cells->i)<>'number' or (new.cells->>i)::numeric<0) then raise exception 'Quantidade ou volume inválido na coluna %',i+1;end if;
  end loop;
 end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function t3b_private.validate_record() from public,anon,authenticated;
create trigger t3b_validate before insert or update on public.t3b_records for each row execute function t3b_private.validate_record();

-- A new receipt creates exactly one stock movement. Imported history never generates duplicates.
create function t3b_private.sync_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'recebimentos' or new.source_key is not null then return new;end if;
 if auth.uid() is null and current_setting('request.jwt.claim.role',true)<>'service_role' then return new;end if;
 if auth.uid() is not null and t3b_private.current_role() not in ('editor','coordenador','analista') then raise exception 'Acesso negado';end if;
 insert into public.t3b_records(kind,cells,parent_id,deleted_at)
 values('movimentacoes',jsonb_build_array(new.cells->1,'Recebimento',new.cells->2,new.cells->3,new.cells->6,new.cells->8,new.cells->9,0,new.cells->11,0,null,null,null,new.cells->15,new.cells->16,'Disponível',null,null,new.cells->12),new.id,new.deleted_at)
 on conflict(parent_id) where parent_id is not null do update set cells=excluded.cells,deleted_at=excluded.deleted_at,revision=t3b_records.revision+1;
 return new;
end;$$;
revoke all on function t3b_private.sync_receipt() from public,anon,authenticated;
create trigger t3b_receipt_movement after insert or update on public.t3b_records for each row execute function t3b_private.sync_receipt();

create function t3b_private.dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or t3b_private.current_role() is null then raise exception 'Acesso negado';end if;
 -- Return chart fields only. No fiscal identifiers, plates, people or observations.
 select coalesce(jsonb_agg(jsonb_build_object('kind',r.kind,'cells',(
  select jsonb_agg(case when i=any(case r.kind when 'recebimentos' then array[1,2,3,4,8,9,10,11,17] when 'movimentacoes' then array[0,1,2,3,5,6,7,8,9] when 'danificados' then array[1,2,6,8,9,10,15,16] when 'apuracoes' then array[0,1,2] when 'semanal' then array[0,1,2,3,4,5] else array[]::integer[] end) then r.cells->i else 'null'::jsonb end order by i)
  from generate_series(0,jsonb_array_length(r.cells)-1) i
 ))),'[]'::jsonb) into result from public.t3b_records r where r.deleted_at is null and r.kind in ('recebimentos','movimentacoes','danificados','apuracoes','semanal');
 return result;
end;$$;
revoke all on function t3b_private.dashboard() from public,anon;
grant execute on function t3b_private.dashboard() to authenticated;
create function public.t3b_dashboard() returns jsonb language sql stable security invoker set search_path='' as $$select t3b_private.dashboard()$$;
revoke all on function public.t3b_dashboard() from public,anon;
grant execute on function public.t3b_dashboard() to authenticated;

create function t3b_private.log_event(event text,details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.t3b_profiles;
begin
 select * into p from public.t3b_profiles where id=auth.uid() and active;
 if auth.uid() is null or p.id is null then raise exception 'Acesso negado';end if;
 if event not in ('page_view','export_pdf','export_excel','presentation','logout') then raise exception 'Evento inválido';end if;
 if octet_length(details::text)>8192 then raise exception 'Detalhes muito extensos';end if;
 if p.role<>'editor' then insert into public.t3b_audit(actor_id,email,role,action,details) values(p.id,p.email,p.role,event,details);end if;
end;$$;
revoke all on function t3b_private.log_event(text,jsonb) from public,anon;
grant execute on function t3b_private.log_event(text,jsonb) to authenticated;
create function public.t3b_log_event(event text,details jsonb default '{}') returns void language sql security invoker set search_path='' as $$select t3b_private.log_event(event,details)$$;
revoke all on function public.t3b_log_event(text,jsonb) from public,anon;
grant execute on function public.t3b_log_event(text,jsonb) to authenticated;
commit;
