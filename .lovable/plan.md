

# Sincronizacao Completa: App ↔ Extensao

## Problema Atual

O sistema tem **3 pontos** onde configuracoes sao salvas, cada um com comportamento diferente:

1. **Settings page** (`save()`): faz dual-write (user_settings + ig_accounts) mas **NAO envia `sync_settings` automaticamente** -- o usuario precisa clicar manualmente em "Forcar sync agora"
2. **Queue page** (configuracoes): faz dual-write + envia `sync_settings` (corrigido na sessao anterior)
3. **Dashboard** (presets de seguranca via Settings): mesma logica da Settings page -- sem auto-sync

Resultado: o usuario salva configuracoes e acha que a extensao ja esta usando, mas ela so le quando faz polling periodico (ate 45s) ou quando recebe o comando `sync_settings`.

## Solucao

### 1. Settings page -- auto-sync apos salvar

Na funcao `save()` (linha ~947 de Settings.tsx), apos o dual-write bem sucedido, enviar automaticamente o comando `sync_settings` para **todas as contas ativas** do usuario. Isso elimina a necessidade de clicar manualmente no botao "Forcar sync agora".

Logica a adicionar apos linha 971:
- Buscar todas as contas ativas do usuario
- Para cada conta, chamar `send_bot_command` com `sync_settings`
- Toast de sucesso ja inclui menssagem de sincronizacao

### 2. Manter o botao "Forcar sync agora" como fallback

O botao na secao ExtensionSyncSection continua existindo para casos onde o usuario quer forcar um re-sync sem salvar (ex: extensao reiniciou).

### 3. Duplicata de useEffect no Queue.tsx

Ha um `useEffect` duplicado no Queue.tsx (linhas 234 e 236-238) que chama `loadQueue()` duas vezes. Sera removido.

## Detalhes Tecnicos

### Arquivo: `src/pages/Settings.tsx`

Na funcao `save()` (~linha 947-980):
- Apos o dual-write (user_settings + ig_accounts) com sucesso
- Buscar `ig_accounts` ativas do usuario: `supabase.from("ig_accounts").select("id").eq("user_id", user.id).eq("is_active", true)`
- Para cada conta, enviar: `supabase.rpc("send_bot_command", { p_ig_account_id: acc.id, p_command: "sync_settings", p_params: {} })`
- Atualizar toast para: "Configuracoes salvas e sincronizadas!"

### Arquivo: `src/pages/Queue.tsx`

- Remover `useEffect` duplicado nas linhas 236-238 (ja coberto pela linha 234)

## Fluxo Resultante

```text
Usuario altera config em QUALQUER pagina (Settings, Queue, Dashboard)
        |
        v
Salva em user_settings.settings_json
        |
        v
Dual-write para ig_accounts (delay_min, delay_max, bot_mode, etc.)
        |
        v
Envia sync_settings automaticamente para todas as contas
        |
        v
Extensao recebe comando e rele ig_accounts imediatamente
```

## Resumo das Alteracoes

| Arquivo | O que muda |
|---|---|
| `src/pages/Settings.tsx` | Adicionar auto-sync_settings na funcao save() |
| `src/pages/Queue.tsx` | Remover useEffect duplicado (linha 236-238) |

