-- Endurece a etapa 1 (revisão do PR #1).

-- Nome do perfil sempre cabe no limite de 120 caracteres, mesmo em cadastros feitos direto pela API do Auth.
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
      left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 120)
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'claude.handle_new_user falhou para %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Privilégios por coluna: o dono só renomeia o espaço (tipo, criador e moeda são imutáveis),
-- só altera o papel de um membro e o usuário só edita nome/avatar do próprio perfil.
revoke update on claude.spaces from authenticated;
grant update (name) on claude.spaces to authenticated;

revoke update on claude.space_members from authenticated;
grant update (role) on claude.space_members to authenticated;

revoke update on claude.profiles from authenticated;
grant update (name, avatar_url) on claude.profiles to authenticated;

-- Perfis nunca são inseridos/apagados pelo app (só pelo trigger e pela cascata de auth.users).
revoke insert, delete on claude.profiles from authenticated;
