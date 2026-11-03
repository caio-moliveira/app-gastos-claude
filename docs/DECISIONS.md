# Decisões de arquitetura

Registro das decisões tomadas de forma autônoma durante a construção do Cofre (PRD §12 e §15).
Formato: contexto, alternativas, decisão e consequências.

## ADR-001: Acesso ao banco via supabase-js, sem ORM
- Contexto: o PRD (§3, §15.2) exige Supabase com RLS e cliente via `@supabase/ssr`; toda leitura do app precisa passar pela sessão do usuário para a RLS valer.
- Alternativas consideradas: Drizzle, Prisma (conexão direta ao Postgres, fora da RLS por padrão).
- Decisão: `@supabase/supabase-js` + `@supabase/ssr`, com tipos gerados pela CLI (`npm run db:types` → `src/lib/supabase/database.types.ts`). Regras que precisam de atomicidade (criar espaço + dono) ficam em funções SQL chamadas por `rpc`.
- Consequências: nenhuma dependência de ORM; a autorização é sempre a do Postgres. Consultas agregadas mais complexas são feitas em funções SQL ou em TypeScript puro sobre linhas já filtradas pela RLS.

## ADR-002: Todas as tabelas no schema `claude` e migrator próprio
- Contexto: o projeto Supabase (`gastos-live`) é compartilhado com outra implementação do mesmo PRD; a API já expõe os schemas `claude` e `codex`. Regra do operador: criar nossas tabelas somente no schema `claude`.
- Alternativas consideradas: schema `public`; `supabase db push` (usa o histórico global `supabase_migrations`, que seria disputado pelas duas implementações).
- Decisão: migrations em `supabase/migrations/*.sql` criando tudo em `claude`; o script `npm run db:migrate` (`scripts/migrate.ts`) aplica os arquivos pendentes em ordem, cada um numa transação, e registra a versão em `claude.schema_migrations`. Os clientes Supabase usam `db: { schema: "claude" }`.
- Consequências: isolamento total em relação ao outro app no mesmo banco. O trigger de perfil em `auth.users` (compartilhado) nunca deixa o cadastro falhar: erros viram `warning`.

## ADR-003: shadcn/ui (Base UI) sobre Tailwind v4
- Contexto: o PRD fixa Tailwind e sugere shadcn/ui (§15.2).
- Alternativas consideradas: Radix puro, Headless UI, componentes próprios.
- Decisão: shadcn/ui no estilo padrão atual (`base-nova`, primitivas `@base-ui/react`, ícones `lucide-react`, toasts `sonner`). Para selects de formulário usamos `<select>` nativo estilizado (`NativeSelect`), que funciona com Server Actions sem estado no cliente.
- Consequências: componentes copiados para `src/components/ui` e editáveis; composição via prop `render` (Base UI) em vez de `asChild`.

## ADR-004: Cache Components desligado
- Contexto: o `create-next-app` do Next 16 liga `cacheComponents`/`partialPrefetching`. Todas as telas do Cofre dependem dos cookies da sessão e de dados por espaço, ou seja, são dinâmicas.
- Alternativas consideradas: manter Cache Components e envolver todo acesso a cookies em `<Suspense>`.
- Decisão: remover `cacheComponents` do `next.config.ts` e usar o modelo dinâmico padrão; após mutações, `revalidatePath` + `router.refresh()` atualizam a tela.
- Consequências: menos configuração e nenhum risco de servir dados de um usuário a outro por cache. Não há ganho de PPR, irrelevante para um app autenticado.

## ADR-005: Estrutura de pastas e divisão Server Components / Server Actions / Route Handlers
- Contexto: PRD §3 e §15.2 (Server Actions para formulários, Route Handler para o chat em streaming).
- Decisão:
  - `src/app/(auth)` — login, cadastro e ações de autenticação.
  - `src/app/s/[spaceId]/...` — tudo que pertence a um espaço; o espaço ativo vem da URL. O layout carrega o contexto (`getSpaceContext`) e responde 404 a quem não é membro.
  - Leitura de dados em Server Components; mutações em Server Actions (`*-actions.ts`) com validação zod no servidor; o chat do agente será um Route Handler em `src/app/api/...`.
  - `src/lib/` — cliente Supabase, validação (`lib/validation`) e regras financeiras puras (sem I/O) testadas com Vitest.
  - `src/proxy.ts` (antigo middleware) renova a sessão e redireciona para `/login`.
- Consequências: a UI esconde ações conforme o papel, mas a garantia é sempre a RLS (ver ADR-006).

## ADR-006: Criação de espaço e espaço "Pessoal" via funções SQL
- Contexto: criar um espaço deve inserir o criador como `owner` na mesma transação (§5) e o primeiro acesso cria `Pessoal` (§6.1). Todo espaço tem exatamente um dono.
- Alternativas consideradas: inserir em duas chamadas pelo app; trigger `after insert` em `spaces`.
- Decisão: `claude.create_space(name, type)` e `claude.ensure_personal_space()` (`security definer`, `search_path` vazio, `auth.uid()` obrigatório, lock consultivo por usuário). Não há policy de `insert` em `spaces`. Um índice único parcial garante no máximo um `owner`, e as policies de `space_members` não deixam ninguém criar, alterar ou remover a linha de dono.
- Consequências: o "exatamente um dono" é garantido pelo banco; transferência de propriedade fica fora do MVP.

## ADR-007: Confirmação de e-mail desativada via `supabase/config.toml`
- Contexto: §6.1 permite desativar a confirmação para a demonstração; o projeto estava com ela ativa.
- Decisão: `supabase/config.toml` versionado com `[auth.email] enable_confirmations = false`, `site_url` de produção, senha mínima de 8 caracteres e redirect URLs restritas a `http://localhost:3000/**`, `https://cofre-claude.vercel.app/**` e aos previews do projeto (`https://cofre-claude-*-moliveiracaio.vercel.app/**`) — nunca `*.vercel.app`, que entregaria tokens de recuperação a qualquer site da Vercel. Aplicado com `supabase config push` (com aprovação do operador, pois o Auth é compartilhado). Os demais valores do arquivo foram alinhados ao remoto para que o push só mude isso.
- Consequências: cadastro entra direto no app. Se o projeto exigir confirmação, o cadastro mostra a mensagem “Confirme seu e-mail para entrar.”.

## ADR-008: Vitest para unitários e integração; RLS testada contra o projeto hospedado
- Contexto: §10 exige testes unitários sem rede e testes de integração das policies.
- Alternativas consideradas: Jest; `supabase start` local (exige Docker).
- Decisão: Vitest roda tudo em `npm test`. Testes unitários ficam junto do código (`src/**/*.test.ts`). Testes de integração (`tests/integration`) criam usuários efêmeros via Admin API com `SUPABASE_SERVICE_ROLE_KEY` (só local), fazem login com a chave pública e verificam a matriz de permissões; ao final os usuários são apagados (cascata). Sem variáveis do Supabase eles são pulados (`describe.skipIf`).
- Consequências: os testes de RLS exercitam exatamente as policies de produção. Rodam em série para não esbarrar em rate limit do Auth.
