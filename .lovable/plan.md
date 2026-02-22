

# Corrigir erro "organic_timings does not exist"

## Problema

Os logs do Postgres mostram erros repetidos:

```
ERROR: column ig_accounts.organic_timings does not exist
```

A extensao Chrome tenta ler/gravar `organic_timings` na tabela `ig_accounts`, mas a coluna nao existe. Mesmo padrao dos erros anteriores (`safety_preset` e `safety_limits`).

## Solucao

### 1. Migracao SQL

Adicionar a coluna `organic_timings` como `jsonb` com um default sensato. Essa coluna provavelmente armazena os horarios em que o bot deve simular atividade organica (pausas, horarios de pico, etc).

```sql
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS organic_timings jsonb
  DEFAULT '{"morning": true, "afternoon": true, "evening": true, "night": false}'::jsonb;
```

### 2. Atualizar Settings para gravar organic_timings

Na funcao `save()` de `src/pages/Settings.tsx`, ao salvar configuracoes, tambem gravar `organic_timings` no update de `ig_accounts` com base no schedule/horarios configurados pelo usuario.

### 3. Varredura de erros adicionais

Apos a migracao, verificar os logs novamente para confirmar que nao ha mais colunas faltando. Se houver, serao corrigidas no mesmo ciclo.

## Detalhes tecnicos

### Arquivo: nova migracao SQL
- `ALTER TABLE public.ig_accounts ADD COLUMN IF NOT EXISTS organic_timings jsonb DEFAULT '{"morning": true, "afternoon": true, "evening": true, "night": false}'::jsonb;`

### Arquivo: `src/pages/Settings.tsx`
- Na funcao `save()`, adicionar `organic_timings` ao objeto de update de `ig_accounts`
- Derivar os valores do `bot_schedule` existente (se houver horarios configurados, mapear para os periodos morning/afternoon/evening/night)

### Tipos TypeScript
- `src/integrations/supabase/types.ts` sera atualizado automaticamente apos a migracao

### Nenhuma mudanca na extensao
- A extensao ja tenta ler `organic_timings` -- basta que a coluna exista com dados validos

