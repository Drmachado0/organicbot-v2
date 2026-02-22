
# Corrigir erro "safety_limits does not exist"

## Problema

Apos resolver o erro de `safety_preset`, os logs do Postgres mostram um novo erro:

```
ERROR: column ig_accounts.safety_limits does not exist
```

A extensao Chrome esta tentando ler uma coluna `safety_limits` da tabela `ig_accounts`, mas ela nao existe.

## Solucao

Adicionar a coluna `safety_limits` como `jsonb` com um valor default que contenha os limites de seguranca baseados nos campos que ja existem na conta (follow_daily_limit, like_daily_limit, etc). A extensao provavelmente espera um objeto JSON com os limites consolidados.

### Migracao SQL

```sql
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS safety_limits jsonb DEFAULT '{"follow_daily": 150, "unfollow_daily": 100, "like_daily": 300}'::jsonb;
```

### Atualizar Settings para gravar safety_limits

Na funcao `save()` de `src/pages/Settings.tsx`, ao salvar as configuracoes, tambem gravar o `safety_limits` com os limites atuais do usuario no formato JSON que a extensao espera.

### Atualizar tipos TypeScript

O arquivo `src/integrations/supabase/types.ts` sera atualizado automaticamente apos a migracao.

## Detalhes tecnicos

### Arquivo: `src/pages/Settings.tsx`
- Na funcao `save()`, junto com o `safety_preset`, adicionar `safety_limits` ao update de `ig_accounts`
- O valor sera um objeto com os limites configurados pelo usuario (ex: `{ follow_daily: settings.follow_daily_limit, like_daily: settings.like_daily_limit, ... }`)

### Nenhuma mudanca na extensao
A extensao ja tenta ler `safety_limits` -- basta que a coluna exista com dados validos.
