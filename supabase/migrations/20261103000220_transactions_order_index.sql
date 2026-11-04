-- Ordem estável da lista paginada: data desc, created_at desc, id desc.
drop index if exists claude.transactions_space_date_idx;
create index transactions_space_date_idx on claude.transactions (space_id, date desc, created_at desc, id desc);
