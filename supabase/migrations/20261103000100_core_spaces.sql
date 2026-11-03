-- Etapa 1: perfis, espaços, membros e RLS básica.
-- Todas as tabelas do app vivem no schema `claude` (o projeto Supabase é compartilhado).

create schema if not exists claude;

grant usage on schema claude to authenticated, service_role;
-- O serviço de Auth dispara o trigger de perfil em auth.users.
grant usage on schema claude to supabase_auth_admin;
revoke all on schema claude from anon;

alter default privileges in schema claude grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema claude grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema claude revoke execute on functions from public;
alter default privileges in schema claude grant execute on functions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table claude.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at timestamptz not null default now()
);

-- Cria o perfil no cadastro. Nunca bloqueia o signup (o Auth é compartilhado com outros apps).
create or replace function claude.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into claude.profiles (id, name)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1))
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'claude.handle_new_user falhou para %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists claude_on_auth_user_created on auth.users;
create trigger claude_on_auth_user_created
  after insert on auth.users
  for each row execute function claude.handle_new_user();

-- Perfis para usuários que já existiam no Auth.
insert into claude.profiles (id, name)
select u.id, left(coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(coalesce(u.email, ''), '@', 1)), 120)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- spaces e space_members
-- ---------------------------------------------------------------------------
create table claude.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type text not null check (type in ('individual', 'shared')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table claude.space_members (
  space_id uuid not null references claude.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- No máximo um dono por espaço (o "pelo menos um" é garantido porque a linha do dono
-- só é criada por claude.create_space e as policies não permitem alterá-la ou removê-la).
create unique index space_members_one_owner on claude.space_members (space_id) where role = 'owner';
create index space_members_user_idx on claude.space_members (user_id);

-- ---------------------------------------------------------------------------
-- Funções de autorização (security definer para evitar recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function claude.space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from claude.space_members m
  where m.space_id = p_space_id
    and m.user_id = (select auth.uid());
$$;

create or replace function claude.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from claude.space_members m
    where m.space_id = p_space_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function claude.can_edit_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(claude.space_role(p_space_id) in ('owner', 'editor'), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table claude.profiles enable row level security;
alter table claude.spaces enable row level security;
alter table claude.space_members enable row level security;

-- profiles: o próprio usuário e quem divide espaço com ele.
create policy profiles_select on claude.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from claude.space_members mine
      join claude.space_members theirs on theirs.space_id = mine.space_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = claude.profiles.id
    )
  );

create policy profiles_update on claude.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- spaces: leitura por membros; renomear/excluir só o dono; criação via claude.create_space.
create policy spaces_select on claude.spaces
  for select to authenticated
  using (claude.is_space_member(id));

create policy spaces_update on claude.spaces
  for update to authenticated
  using (claude.space_role(id) = 'owner')
  with check (claude.space_role(id) = 'owner');

create policy spaces_delete on claude.spaces
  for delete to authenticated
  using (claude.space_role(id) = 'owner');

-- space_members: leitura por membros; só o dono gerencia, e nunca a linha de dono.
create policy space_members_select on claude.space_members
  for select to authenticated
  using (claude.is_space_member(space_id));

create policy space_members_insert on claude.space_members
  for insert to authenticated
  with check (claude.space_role(space_id) = 'owner' and role <> 'owner');

create policy space_members_update on claude.space_members
  for update to authenticated
  using (claude.space_role(space_id) = 'owner' and role <> 'owner')
  with check (claude.space_role(space_id) = 'owner' and role <> 'owner');

create policy space_members_delete on claude.space_members
  for delete to authenticated
  using (claude.space_role(space_id) = 'owner' and role <> 'owner');

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Cria um espaço e insere o criador como dono na mesma transação.
create or replace function claude.create_space(p_name text, p_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_space_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if p_type not in ('individual', 'shared') then
    raise exception 'Tipo de espaço inválido.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'O nome do espaço deve ter entre 1 e 60 caracteres.' using errcode = '22023';
  end if;

  insert into claude.spaces (name, type, created_by)
  values (btrim(p_name), p_type, v_uid)
  returning id into v_space_id;

  insert into claude.space_members (space_id, user_id, role)
  values (v_space_id, v_uid, 'owner');

  return v_space_id;
end;
$$;

-- Garante que o usuário tenha ao menos um espaço; cria "Pessoal" no primeiro acesso.
-- Retorna o espaço padrão (o mais antigo em que o usuário é membro).
create or replace function claude.ensure_personal_space()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_space_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário.
  perform pg_advisory_xact_lock(hashtextextended('claude.ensure_personal_space:' || v_uid::text, 0));

  select m.space_id into v_space_id
  from claude.space_members m
  where m.user_id = v_uid
  order by m.joined_at, m.space_id
  limit 1;

  if v_space_id is null then
    v_space_id := claude.create_space('Pessoal', 'individual');
  end if;

  return v_space_id;
end;
$$;

revoke execute on all functions in schema claude from public, anon;
grant execute on function claude.create_space(text, text) to authenticated;
grant execute on function claude.ensure_personal_space() to authenticated;
grant execute on function claude.space_role(uuid) to authenticated;
grant execute on function claude.is_space_member(uuid) to authenticated;
grant execute on function claude.can_edit_space(uuid) to authenticated;
