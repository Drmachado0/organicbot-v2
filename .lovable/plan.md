
# Revisao e Ajustes

## Problemas Encontrados

### 1. Realtime do Dashboard nao atualiza `profile_pic_url`
No `useDashboardV2.ts` (linha 312), a subscription de realtime para `ig_accounts` so sincroniza `queue_total`, `queue_processed`, `bot_online` e `bot_status`. Quando a extensao atualiza `profile_pic_url`, `followers_count`, `following_count` ou `bot_mode`, o Dashboard nao reflete a mudanca em tempo real.

**Correcao**: Adicionar `profile_pic_url`, `followers_count`, `following_count`, `bot_mode`, `last_heartbeat` ao merge do realtime.

### 2. Closure stale de `campaignNames` no Queue.tsx
Na funcao `loadQueue` (linha 243), o codigo usa `campaignNames` do state para enriquecer as rows, mas o `setCampaignNames` acabou de ser chamado na linha 235. Como o state ainda nao atualizou naquele render, os nomes de campanha ficam vazios na primeira carga.

**Correcao**: Usar a variavel local `names` diretamente ao inves do state `campaignNames` para enriquecer as rows.

### 3. `loadQueue` nao inclui `campaignNames` na dependency array
O `useCallback` do `loadQueue` (linha 248) depende de `campaignNames` implicitamente mas nao o lista como dependencia. Apos corrigir o item 2 (usar variavel local), essa dependencia deixa de existir.

### 4. Edge Function `fetch-profile-pic` sem autenticacao
A funcao esta com `verify_jwt = false`, permitindo que qualquer pessoa chame e atualize fotos de qualquer conta. Deveria validar o JWT e verificar que o usuario e dono da conta.

**Correcao**: Mudar para `verify_jwt = true` no config.toml e adicionar validacao de ownership na edge function.

---

## Alteracoes

### `src/hooks/useDashboardV2.ts`
- Linha 312: expandir o merge do realtime para incluir todos os campos relevantes (`profile_pic_url`, `followers_count`, `following_count`, `bot_mode`, `last_heartbeat`)

### `src/pages/Queue.tsx`
- Linhas 240-248: Corrigir `loadQueue` para usar a variavel local dos nomes de campanha ao inves do state (que pode estar stale)

### `supabase/functions/fetch-profile-pic/index.ts`
- Adicionar validacao de JWT e ownership (verificar que o usuario autenticado e dono da `ig_account`)

### `supabase/config.toml`
- Alterar `verify_jwt` do `fetch-profile-pic` para `true`
