-- Etapa 2: contas, categorias e transações, com integridade entre espaços e RLS.

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table claude.accounts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references claude.spaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type text not null check (type in ('checking', 'savings', 'credit_card', 'cash', 'investment')),
  initial_balance_cents bigint not null default 0
    check (initial_balance_cents between -99999999999 and 99999999999),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (space_id, id)
);
create unique index accounts_space_name_uq on claude.accounts (space_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table claude.categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references claude.spaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text check (icon is null or char_length(icon) <= 40),
  created_at timestamptz not null default now(),
  unique (space_id, id),
  unique (space_id, id, kind)
);
-- Nome único por espaço e tipo (sem diferenciar maiúsculas).
create unique index categories_space_kind_name_uq on claude.categories (space_id, kind, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table claude.transactions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references claude.spaces (id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  date date not null,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  transfer_to_account_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Conta, categoria e conta de destino precisam ser do MESMO espaço (FK composta).
  foreign key (space_id, account_id) references claude.accounts (space_id, id),
  foreign key (space_id, category_id) references claude.categories (space_id, id),
  foreign key (space_id, transfer_to_account_id) references claude.accounts (space_id, id),
  -- Formato por tipo: transferência sem categoria e com destino diferente da origem;
  -- receita/despesa com categoria e sem destino.
  constraint transactions_shape check (
    (type = 'transfer' and category_id is null and transfer_to_account_id is not null
      and transfer_to_account_id <> account_id)
    or (type in ('income', 'expense') and category_id is not null and transfer_to_account_id is null)
  )
);
create index transactions_space_date_idx on claude.transactions (space_id, date desc, created_at desc);
create index transactions_account_idx on claude.transactions (account_id);
create index transactions_transfer_to_idx on claude.transactions (transfer_to_account_id) where transfer_to_account_id is not null;
create index transactions_category_idx on claude.transactions (category_id) where category_id is not null;

-- Categoria precisa ter o mesmo tipo da transação (receita ↔ receita, despesa ↔ despesa)
-- e o espaço de uma transação não muda depois de criada.
create or replace function claude.transactions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
begin
  if tg_op = 'UPDATE' and new.space_id <> old.space_id then
    raise exception 'Não é possível mover a transação para outro espaço.' using errcode = '22023';
  end if;
  if new.category_id is not null then
    select c.kind into v_kind from claude.categories c where c.id = new.category_id and c.space_id = new.space_id;
    if v_kind is distinct from new.type then
      raise exception 'A categoria não corresponde ao tipo da transação.' using errcode = '22023';
    end if;
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  elsif auth.uid() is not null then
    -- Pelo app, o autor é sempre o usuário da sessão (scripts com service role podem informar).
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger transactions_guard
  before insert or update on claude.transactions
  for each row execute function claude.transactions_guard();

-- Categoria não pode mudar de tipo se já estiver em uso; conta/categoria não mudam de espaço.
create or replace function claude.categories_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.space_id <> old.space_id then
    raise exception 'Não é possível mover a categoria para outro espaço.' using errcode = '22023';
  end if;
  if new.kind <> old.kind and exists (select 1 from claude.transactions t where t.category_id = old.id) then
    raise exception 'A categoria já tem transações e não pode mudar de tipo.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger categories_guard
  before update on claude.categories
  for each row execute function claude.categories_guard();

create or replace function claude.accounts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.space_id <> old.space_id then
    raise exception 'Não é possível mover a conta para outro espaço.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger accounts_guard
  before update on claude.accounts
  for each row execute function claude.accounts_guard();

-- ---------------------------------------------------------------------------
-- RLS: leitura por membros; escrita por owner/editor.
-- ---------------------------------------------------------------------------
alter table claude.accounts enable row level security;
alter table claude.categories enable row level security;
alter table claude.transactions enable row level security;

create policy accounts_select on claude.accounts for select to authenticated using (claude.is_space_member(space_id));
create policy accounts_insert on claude.accounts for insert to authenticated with check (claude.can_edit_space(space_id));
create policy accounts_update on claude.accounts for update to authenticated
  using (claude.can_edit_space(space_id)) with check (claude.can_edit_space(space_id));
create policy accounts_delete on claude.accounts for delete to authenticated using (claude.can_edit_space(space_id));

create policy categories_select on claude.categories for select to authenticated using (claude.is_space_member(space_id));
create policy categories_insert on claude.categories for insert to authenticated with check (claude.can_edit_space(space_id));
create policy categories_update on claude.categories for update to authenticated
  using (claude.can_edit_space(space_id)) with check (claude.can_edit_space(space_id));
create policy categories_delete on claude.categories for delete to authenticated using (claude.can_edit_space(space_id));

create policy transactions_select on claude.transactions for select to authenticated using (claude.is_space_member(space_id));
create policy transactions_insert on claude.transactions for insert to authenticated with check (claude.can_edit_space(space_id));
create policy transactions_update on claude.transactions for update to authenticated
  using (claude.can_edit_space(space_id)) with check (claude.can_edit_space(space_id));
create policy transactions_delete on claude.transactions for delete to authenticated using (claude.can_edit_space(space_id));

-- ---------------------------------------------------------------------------
-- Padrões do espaço: categorias padrão + conta "Carteira"
-- ---------------------------------------------------------------------------
create or replace function claude.seed_space_defaults(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into claude.categories (space_id, name, kind, color, icon)
  values
    (p_space_id, 'Salário', 'income', '#16a34a', 'briefcase'),
    (p_space_id, 'Freelance', 'income', '#0d9488', 'laptop'),
    (p_space_id, 'Outros', 'income', '#65a30d', 'plus-circle'),
    (p_space_id, 'Moradia', 'expense', '#7c3aed', 'home'),
    (p_space_id, 'Alimentação', 'expense', '#ea580c', 'utensils'),
    (p_space_id, 'Mercado', 'expense', '#d97706', 'shopping-cart'),
    (p_space_id, 'Transporte', 'expense', '#2563eb', 'car'),
    (p_space_id, 'Saúde', 'expense', '#dc2626', 'heart-pulse'),
    (p_space_id, 'Lazer', 'expense', '#db2777', 'party-popper'),
    (p_space_id, 'Educação', 'expense', '#0891b2', 'graduation-cap'),
    (p_space_id, 'Assinaturas', 'expense', '#4f46e5', 'repeat'),
    (p_space_id, 'Outros', 'expense', '#64748b', 'ellipsis')
  on conflict do nothing;

  if not exists (select 1 from claude.accounts a where a.space_id = p_space_id) then
    insert into claude.accounts (space_id, name, type, initial_balance_cents)
    values (p_space_id, 'Carteira', 'cash', 0);
  end if;
end;
$$;

revoke execute on function claude.seed_space_defaults(uuid) from public, anon, authenticated;

-- create_space passa a criar os padrões na mesma transação.
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

  perform claude.seed_space_defaults(v_space_id);

  return v_space_id;
end;
$$;

-- Espaços já existentes recebem os padrões.
select claude.seed_space_defaults(s.id) from claude.spaces s;

grant select, insert, update, delete on claude.accounts, claude.categories, claude.transactions to authenticated, service_role;
