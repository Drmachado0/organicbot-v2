
# Revisão Completa — Organic Pro

## Estado Atual do Projeto

### Implementado e Funcional
- **Dashboard** (`/dashboard`): KPIs, gráficos, LiveStatusBar, toggle do bot, realtime via Supabase
- **Campanhas** (`/campaigns`): CRUD completo com TagInput para hashtags/concorrentes, TargetQueuePanel, ativar/desativar
- **Relatórios** (`/reports`): Gráficos Recharts (ações diárias, crescimento, sessões), exportação CSV, seletor de período
- **Whitelist** (`/whitelist`): Lista com busca debounced, paginação server-side, adicionar/remover
- **Log de Ações** (`/actions`): Filtro por tipo/status, paginação, busca por username
- **Settings** (`/settings`): Limites diários, delays, agendamento por hora, filtros do bot, bridge token
- **Sidebar**: Realtime subscription para atualizar nome/avatar automaticamente
- **Auth**: Login, registro, reset de senha, rotas protegidas

### Lacunas e Melhorias Identificadas

#### 1. Campanhas — Falta "Injetar Targets"
O botão para popular a `target_queue` a partir dos concorrentes/hashtags da campanha ainda não existe. A função `add_targets_batch` já está no banco, mas nunca é chamada pelo frontend.

#### 2. Actions — Sem Realtime
A página `/actions` não tem subscription em tempo real. Novos registros em `action_log` só aparecem após refresh manual.

#### 3. Reports — Sem Realtime / Sem Comparativo
A página de relatórios não tem comparação entre períodos (ex: esta semana vs semana anterior) e não atualiza automaticamente quando novas sessões terminam.

#### 4. Dashboard — Bot Commands ausentes
O `useDashboardV2` chama `toggleBot()` via `user_settings.automation_paused`, mas a tabela `bot_commands` (com a função `send_bot_command`) nunca é usada. O bot real usa comandos, não só o flag.

#### 5. Settings — Agendamento visual pouco intuitivo
O grid de 24 horas existe mas não tem labels AM/PM, nem indicador visual do horário atual.

#### 6. Whitelist — Sem filtro por conta Instagram
A whitelist filtra por `user_id` mas não por `ig_account_id`, então não é possível ver a whitelist separada por conta.

#### 7. Sem notificações/alertas push
O `HealthAlertsCard` exibe alertas, mas não há sistema de notificação persistente (toast proativo quando o bot vai offline, por exemplo).

---

## Próximas Implementações — Ordem de Prioridade

### Prioridade 1 — Injetar Targets nas Campanhas
Adicionar botão "Injetar Targets" em cada campanha ativa que chama `add_targets_batch` com os usernames dos concorrentes definidos na campanha. Mostra modal com progresso e resultado (quantos inseridos, quantos já existiam).

**Arquivos afetados:** `src/pages/Campaigns.tsx`

### Prioridade 2 — Realtime no Log de Ações
Adicionar subscription Supabase Realtime na página `/actions` para novos INSERTs em `action_log`, com animação de entrada na nova linha e badge "novo" temporário.

**Arquivos afetados:** `src/pages/Actions.tsx`

### Prioridade 3 — Bot Commands via `send_bot_command`
No Dashboard, substituir o toggle simples por chamadas reais à função `send_bot_command` para os comandos `start`, `pause`, `stop`. Exibir o histórico dos últimos comandos enviados com status (pending/executed).

**Arquivos afetados:** `src/pages/Dashboard.tsx`, `src/hooks/useDashboardV2.ts`

### Prioridade 4 — Comparativo de Período em Reports
Adicionar linha "período anterior" nos gráficos de ações e crescimento para comparação visual (ex: esta semana vs semana passada). Exibir delta percentual nos KPIs.

**Arquivos afetados:** `src/pages/Reports.tsx`

### Prioridade 5 — Filtro por Conta no Whitelist
Adicionar seletor de conta Instagram no topo da página `/whitelist` para filtrar a lista por `ig_account_id`. Útil quando o usuário tem múltiplas contas.

**Arquivos afetados:** `src/pages/Whitelist.tsx`

---

## Detalhes Técnicos

### Injetar Targets (Prioridade 1)
```text
Campanha ativa → Botão "Injetar Targets"
→ Modal: selecionar conta Instagram de destino
→ Extrair array de competitors[] da campanha
→ Chamar: supabase.rpc("add_targets_batch", {
     p_ig_account_id: selectedAccountId,
     p_usernames: competitors,
     p_source: "campaign"
  })
→ Toast com resultado: "X targets adicionados"
→ TargetQueuePanel atualiza automaticamente
```

### Realtime no Log de Ações (Prioridade 2)
```text
useEffect → supabase.channel("actions-realtime-{userId}")
  .on("postgres_changes", { event: "INSERT", table: "action_log" }, handler)
→ Prepend nova linha com classe "animate-fade-in"
→ Badge "NOVO" desaparece após 3s
→ Limitar lista a 200 entradas para evitar overflow de memória
```

### Bot Commands (Prioridade 3)
```text
toggleBot() atual:
  UPDATE user_settings SET automation_paused = true

toggleBot() novo:
  supabase.rpc("send_bot_command", {
    p_ig_account_id: activeAccountId,
    p_command: "pause" | "start",
    p_params: {}
  })
  + UPDATE user_settings (mantém flag como fallback)
```
