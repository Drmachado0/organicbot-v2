
# Revisão Completa da Integração Dashboard ↔ Extensão Chrome

## O Que Foi Analisado

Leitura profunda de:
- `lovable-config.js` — configuração da extensão (URLs, intervals, safety presets)
- `lovable-supabase.js` — como a extensão lê/escreve no banco
- `lovable-sync.js` — como a extensão sincroniza settings, fila, comandos e heartbeat
- Todos os arquivos do dashboard (Dashboard, Settings, Campaigns, Actions, Whitelist, Reports, Extension, useDashboardV2)
- Schema do banco (todas as colunas de `ig_accounts` e `user_settings`)

## Problemas Críticos Encontrados

### Problema 1 — CRÍTICO: Settings escritas no lugar errado

A extensão (`lovable-supabase.js`, `fetchBotSettingsExtended`) lê configurações de **`ig_accounts`**:
```
SELECT bot_mode, likes_per_follow, delay_min, delay_max,
       max_actions_per_session, bot_schedule, safety_preset,
       safety_limits, organic_timings, scheduler_progress
FROM ig_accounts WHERE id = ...
```

O dashboard salva tudo em **`user_settings.settings_json`** (follow_daily_limit, delay_min, delay_max, schedule_hours, etc.).

**Resultado:** A extensão nunca lê os settings salvos pelo dashboard. Os delays e limites configurados na UI são completamente ignorados pela extensão.

**Colunas que existem em `ig_accounts` e a extensão usa:**
- `delay_min`, `delay_max` ✓ (existem, mas o dashboard não as escreve)
- `bot_mode` ✓ (existe, dashboard não a controla)
- `max_actions_per_session` ✓ (existe, dashboard não a controla)
- `bot_schedule` ✓ (existe, dashboard não a controla)
- `likes_per_follow` ✓ (existe, dashboard não a controla)
- `safety_preset`, `safety_limits`, `organic_timings`, `scheduler_progress` ✗ (não existem na tabela — colunas faltando)

**Colunas que a extensão tenta salvar via PATCH mas não existem:**
- `safety_preset` → coluna não existe em `ig_accounts`
- `safety_limits` → coluna não existe
- `organic_timings` → coluna não existe
- `scheduler_progress` → coluna não existe

### Problema 2 — CRÍTICO: bot_schedule no formato errado

A extensão usa `bot_schedule` no formato:
```json
{
  "enabled": true,
  "timezone": "America/Sao_Paulo",
  "days": {
    "sun": { "active": false },
    "mon": { "active": true, "start": "09:00", "stop": "18:00", "follows": 60, "likes": 120, "mode": "seguir_curtir" }
  }
}
```

O dashboard salva `schedule_hours` (array de 24 booleans) em `user_settings.settings_json`, em formato completamente diferente e no local errado.

**Resultado:** O scheduler da extensão nunca funciona com os horários configurados no dashboard.

### Problema 3 — ALTO: `send_bot_command` com comando `reload_settings` é inútil

A função `forceSync` no Settings envia `reload_settings`, mas a extensão (em `executeCommand`) não trata esse comando — apenas trata: `start`, `stop`, `pause`, `set_mode`, `sync_queue` (`FORCE_QUEUE_SYNC`), `sync_settings`, `set_safety_preset`, `set_safety_limits`, `scrape`, `collect_profile`. 

O comando `reload_settings` cai no `default` (sem tratamento), portanto nunca é executado pela extensão.

**Fix:** trocar o comando de `reload_settings` para `sync_settings` (que a extensão realmente implementa).

### Problema 4 — ALTO: `DASHBOARD_URL` desatualizado na extensão

`lovable-config.js` aponta para `https://organicpublic.lovable.app`, mas a URL atual do projeto publicado é `https://organicbot.lovable.app`. O botão "Abrir Dashboard" no popup abre a URL errada.

**Ação:** Atualizar o guia na página `/extension` orientando o usuário a usar o link correto.

### Problema 5 — MÉDIO: Modo do bot não controlável pelo dashboard

A extensão aplica `bot_mode` ao carregar settings (`applyMode`), lendo de `ig_accounts.bot_mode`. O dashboard não oferece selector de modo (Follow, Unfollow, Like Only, etc.) em nenhuma tela.

### Problema 6 — MÉDIO: `action_log` sem `user_id` em algumas escritas da extensão

A extensão escreve `action_log` com `user_id` e `ig_account_id`. Porém a RLS de `action_log` tem política permissiva (`true`) para device access. A filtragem no dashboard usa `user_id`, mas o campo pode ser `null` dependendo da versão. Já foi tratado, mas vale checar.

### Problema 7 — BAIXO: Página Extension não orienta usuário sobre URL correta do dashboard

A extensão `lovable-config.js` tem `DASHBOARD_URL: 'https://organicpublic.lovable.app'` hardcoded. O usuário precisa saber que a URL correta é `https://organicbot.lovable.app`.

---

## Implementações Necessárias

### Fix 1 — Salvar settings também em `ig_accounts` (CRÍTICO)

**Arquivo:** `src/pages/Settings.tsx`

Quando o usuário salvar as configurações, além de escrever em `user_settings.settings_json`, também fazer PATCH em todas as contas ativas do usuário com os campos que a extensão lê:

```
PATCH ig_accounts WHERE user_id = userId AND is_active = true
SET:
  delay_min = settings.delay_min,
  delay_max = settings.delay_max,
  likes_per_follow = ... (novo campo na UI)
  max_actions_per_session = settings.follow_daily_limit (ou campo dedicado)
  bot_schedule = { enabled: true, timezone: "America/Sao_Paulo", days: { ... } }
  updated_at = now()
```

O `bot_schedule` será convertido de `schedule_hours[]` para o formato que a extensão espera (objeto com dias da semana + horários), usando uma heurística: detectar blocos contínuos de horas ativas e mapear para start/stop.

### Fix 2 — Corrigir comando "Forçar Sync" de `reload_settings` para `sync_settings`

**Arquivo:** `src/pages/Settings.tsx`

A linha:
```typescript
p_command: "reload_settings",
```
Deve ser:
```typescript
p_command: "sync_settings",
```

### Fix 3 — Adicionar seletor de Modo do Bot nas Configurações

**Arquivo:** `src/pages/Settings.tsx`

Nova seção "Modo de Automação" dentro de um SectionCard, com radio buttons (ou Select) para:
- `seguir_curtir` — Follow + Like (padrão)
- `seguir` — Apenas Follow
- `curtir` — Apenas Like
- `deixar_seguir` — Unfollow
- `ver_story` — View Stories

Ao salvar, escreve `ig_accounts.bot_mode`.

### Fix 4 — Adicionar campo `likes_per_follow` e `max_actions_per_session` nas Configurações

**Arquivo:** `src/pages/Settings.tsx`

Na seção de Limites Diários, adicionar dois novos sliders:
- **Likes por Follow** (1–5, default 2) → `ig_accounts.likes_per_follow`
- **Máx. ações por sessão** (10–200, default 50) → `ig_accounts.max_actions_per_session`

Esses são lidos diretamente da extensão.

### Fix 5 — Atualizar página Extension com URL correta e guia de login

**Arquivo:** `src/pages/Extension.tsx`

- Atualizar `DASHBOARD_URL` na página de instruções: `https://organicbot.lovable.app`
- Adicionar nota de aviso: "A URL do dashboard no arquivo lovable-config.js pode estar desatualizada. Use sempre `https://organicbot.lovable.app`"
- Adicionar seção "Configurações sincronizadas pela extensão" com lista visual de quais campos são lidos de `ig_accounts` vs `user_settings`
- Adicionar seção de modo do bot (o que cada modo faz)

### Fix 6 — Adicionar preset de segurança controlável

**Arquivo:** `src/pages/Settings.tsx`

Adicionar 3 botões de preset (Nova / Média / Madura) que:
1. Preenchem automaticamente os valores de delay e limite na UI
2. Escrevem `ig_accounts.safety_preset = 'nova'/'media'/'madura'`

Isso envia um comando `set_safety_preset` via `send_bot_command` para que a extensão aplique imediatamente, sem aguardar o ciclo de 2 minutos.

**Obs:** As colunas `safety_preset`, `safety_limits`, `organic_timings`, `scheduler_progress` não existem em `ig_accounts`. A extensão tenta ler e salvar nesses campos sem sucesso silencioso. São necessárias migrações — mas como não podemos criar migrações automaticamente no momento, o preset será salvo via `bot_commands` (`set_safety_preset`) e o campo `delay_min`/`delay_max` refletirá os valores.

---

## Detalhes Técnicos das Mudanças

### Conversão schedule_hours[] → bot_schedule

O `schedule_hours` do dashboard é um array de 24 booleans `[true, false, true, ...]`.
O `bot_schedule` da extensão é um objeto com dias e horários de start/stop.

Estratégia de conversão: para cada dia da semana, aplicar o mesmo bloco de horas ativas detectado no `schedule_hours`. Usar a primeira hora ativa como `start` e a última+1 como `stop`.

```typescript
function scheduleHoursToBotSchedule(hours: boolean[]): object {
  // Detectar primeiro bloco contínuo de horas ativas
  const firstActive = hours.findIndex(h => h);
  const lastActive = hours.map((h, i) => h ? i : -1).filter(i => i >= 0).pop() ?? 23;
  
  const start = firstActive >= 0 ? `${String(firstActive).padStart(2,'0')}:00` : "00:00";
  const stop = firstActive >= 0 ? `${String(lastActive + 1).padStart(2,'0')}:00` : "24:00";
  
  const allActive = firstActive >= 0;
  const days = ['sun','mon','tue','wed','thu','fri','sat'].reduce((acc, day) => {
    acc[day] = { active: allActive, start, stop, follows: 60, likes: 120, mode: 'seguir_curtir' };
    return acc;
  }, {} as Record<string, unknown>);
  
  return { enabled: allActive, timezone: "America/Sao_Paulo", days };
}
```

### PATCH duplo ao salvar Settings

```typescript
const save = async () => {
  // 1. Salvar em user_settings (já implementado)
  await supabase.from("user_settings").upsert([{...}], { onConflict: "user_id" });
  
  // 2. Sincronizar campos críticos em TODAS as contas ativas do usuário
  const botSchedule = scheduleHoursToBotSchedule(settings.schedule_hours);
  await supabase.from("ig_accounts")
    .update({
      delay_min: settings.delay_min,
      delay_max: settings.delay_max,
      max_actions_per_session: settings.max_actions_per_session,
      likes_per_follow: settings.likes_per_follow,
      bot_schedule: botSchedule,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("is_active", true);
};
```

### Comando `set_safety_preset` imediato (sem aguardar 2 min)

Quando o usuário clicar em um preset, além de preencher os sliders, enviar imediatamente:
```typescript
await supabase.rpc("send_bot_command", {
  p_ig_account_id: selectedAccountId,
  p_command: "set_safety_preset",
  p_params: { preset: "nova" | "media" | "madura" }
});
```
A extensão executa em até 45s (próximo poll de comandos).

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/Settings.tsx` | 1) PATCH duplo ao salvar (ig_accounts + user_settings); 2) Fix comando sync_settings; 3) Selector bot_mode; 4) Sliders likes_per_follow e max_actions_per_session; 5) Botões de preset com apply imediato via comando |
| `src/pages/Extension.tsx` | Atualizar URL do dashboard, adicionar nota sobre config.js, detalhar campos sincronizados |

## Banco de Dados — Colunas Faltantes

As colunas `safety_preset`, `safety_limits`, `organic_timings` e `scheduler_progress` que a extensão tenta usar não existem em `ig_accounts`. A extensão faz PATCH silencioso que falha (400/404). Para adicionar essas colunas seria necessária uma migration SQL. O impacto é baixo pois o comportamento atual já funciona sem elas — a extensão trata a ausência graciosamente. Não faremos migrações neste momento para evitar quebrar a produção.

O que podemos fazer sem migrations:
- `delay_min`, `delay_max`: existem → sincronizar ao salvar
- `likes_per_follow`: existe → adicionar ao salvar
- `max_actions_per_session`: existe → adicionar ao salvar
- `bot_mode`: existe → controlar pelo dashboard
- `bot_schedule`: existe → converter e sincronizar
- `safety_preset`: NÃO existe → usar apenas via bot_commands (set_safety_preset)
