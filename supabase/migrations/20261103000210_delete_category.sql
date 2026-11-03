-- Exclui uma categoria; se estiver em uso, move as transações para outra categoria do mesmo
-- espaço e tipo, tudo na mesma transação. SECURITY INVOKER: a RLS do usuário continua valendo.
create or replace function claude.delete_category(p_category_id uuid, p_move_to uuid default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_space uuid;
  v_kind text;
  v_in_use boolean;
begin
  select c.space_id, c.kind into v_space, v_kind from claude.categories c where c.id = p_category_id;
  if v_space is null then
    raise exception 'Categoria não encontrada.' using errcode = '22023';
  end if;
  if not claude.can_edit_space(v_space) then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;

  select exists (select 1 from claude.transactions t where t.category_id = p_category_id) into v_in_use;

  if v_in_use then
    if p_move_to is null then
      raise exception 'A categoria tem transações. Escolha outra categoria para movê-las.' using errcode = '22023';
    end if;
    if p_move_to = p_category_id or not exists (
      select 1 from claude.categories c where c.id = p_move_to and c.space_id = v_space and c.kind = v_kind
    ) then
      raise exception 'Categoria de destino inválida.' using errcode = '22023';
    end if;
    update claude.transactions set category_id = p_move_to where category_id = p_category_id;
  end if;

  delete from claude.categories where id = p_category_id;
end;
$$;

revoke execute on function claude.delete_category(uuid, uuid) from public, anon;
grant execute on function claude.delete_category(uuid, uuid) to authenticated;
