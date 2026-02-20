
# Auto-Sync Completo em Todo o Projeto

## Problema

Os presets de seguranca na Settings page enviam um comando `set_safety_preset` para a extensao mas NAO fazem a escrita dupla (dual-write) nas tabelas `user_settings` e `ig_accounts`. Isso significa que:
- A extensao recebe o comando mas os valores nao ficam persistidos no banco
- Se a extensao reiniciar, perde as configuracoes do preset
- A Settings page mostra os valores na UI (via `setSettings`) mas se o usuario recarregar a pagina, volta aos valores antigos

Alem disso, o `toggleBot` no dashboard envia pause/start mas nao envia `sync_settings` para garantir que a extensao releia todas as configs.

## Alteracoes

### 1. Safety Presets com dual-write completo (`src/pages/Settings.tsx`)

Na funcao onClick dos presets (linhas 1068-1093), apos atualizar o estado local:

- Fazer `upsert` em `user_settings.settings_json` com os valores do preset (delay_min, delay_max, follow_daily_limit, etc.)
- Fazer `update` em `ig_accounts` com os campos que a extensao le diretamente (delay_min, delay_max, max_actions_per_session, likes_per_follow)
- Enviar `sync_settings` em vez de `set_safety_preset` (para a extensao reler os valores do banco em vez de depender dos params do comando)
- Marcar `isDirty = false` pois os dados ja foram salvos

### 2. toggleBot com sync_settings (`src/hooks/useDashboardV2.ts`)

Na funcao `toggleBot` (linha 297-335), apos enviar o comando pause/start e atualizar `user_settings.automation_paused`:

- Enviar tambem `sync_settings` para a conta ativa, garantindo que a extensao releia o estado de automacao

### Detalhes Tecnicos

**Settings.tsx - Preset onClick (substituir linhas 1068-1093):**

```text
onClick:
1. setSettings(...) -- atualizar UI local (ja existe)
2. setIsDirty(false) -- nao precisa mais salvar manualmente
3. Buscar settings_json atual do user_settings
4. Fazer merge com valores do preset
5. Upsert em user_settings com o JSON merged
6. Update em ig_accounts: delay_min, delay_max, max_actions_per_session, likes_per_follow
7. Enviar sync_settings para todas as contas ativas
8. Toast de sucesso
```

**useDashboardV2.ts - toggleBot (apos linha 322):**

```text
Apos o upsert de automation_paused:
- supabase.rpc("send_bot_command", { p_command: "sync_settings" })
```

## Fluxo Resultante

```text
Preset clicado / Bot pausado/iniciado
        |
        v
Valores persistidos em user_settings + ig_accounts
        |
        v
Comando sync_settings enviado
        |
        v
Extensao rele ig_accounts imediatamente
```

## Resumo

| Arquivo | O que muda |
|---|---|
| src/pages/Settings.tsx | Presets fazem dual-write + sync_settings em vez de apenas set_safety_preset |
| src/hooks/useDashboardV2.ts | toggleBot envia sync_settings apos pause/start |
