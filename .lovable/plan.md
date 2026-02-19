
# Próximos Passos — O que ainda falta para o sistema ser completo

## Estado Atual (o que já funciona)

- Dashboard com KPIs, gráficos, tabelas, sessões e alertas de saúde em tempo real
- Notificação automática quando bot vai offline (toast + badge na topbar)
- Configurações com dual-write para `ig_accounts` + `user_settings`
- Seletor de modo do bot, presets de segurança, delays, likes_per_follow
- Conversão de `schedule_hours[]` → `bot_schedule` para a extensão
- Comando `sync_settings` corrigido
- Página `/extension` com guia de instalação e status por heartbeat
- Deep link `?account=@username` no dashboard
- Badge online/offline na topbar em tempo real via Realtime

---

## O que ainda falta — por prioridade

### 1. CRÍTICO — `queue_sync` manual por conta (sem essa função, o bot não processa targets)

A extensão processa targets da `target_queue`. Atualmente, quando o usuário vai em Campanhas e injeta targets, a extensão só os pega no próximo ciclo de sincronização (2 min). Não existe botão no dashboard para forçar a extensão a buscar a fila imediatamente com `sync_queue`.

**O que fazer:**
- No **Dashboard**, adicionar um botão "Sincronizar Fila" ao lado do botão "Iniciar Bot"
- Ao clicar, envia `send_bot_command({ command: "sync_queue", p_ig_account_id: activeAccountId })`
- O card de KPI "Fila Pendente" deve mostrar o número atualizado em tempo real
- Na página **Campanhas**, no modal de "Injetar Targets", adicionar opção de enviar o comando `sync_queue` logo após a injeção

### 2. ALTO — Indicador de progresso da fila por conta

Atualmente, `ig_accounts.queue_total` e `ig_accounts.queue_processed` existem no banco e são atualizados pela extensão, mas o dashboard não os exibe como barra de progresso. O usuário não sabe quanto da fila já foi processado.

**O que fazer:**
- No **Dashboard**, no card "Fila Pendente" (KpiCard), adicionar uma barra de progresso `queue_processed / queue_total`
- Atualizar via Realtime quando a extensão fizer UPDATE em `ig_accounts`
- Mostrar percentual: "247 de 1.200 processados (21%)"

### 3. ALTO — Histórico de comandos expandido com ações rápidas

O painel "Comandos Recentes" no Dashboard mostra apenas 5 linhas e tem informação limitada. Não há como enviar um comando específico sem ir em Configurações.

**O que fazer:**
- Expandir o painel de comandos para 10 itens com scroll
- Adicionar botões de ação rápida inline:
  - **Start** / **Pause** / **Stop** (com confirmação para Stop)
  - **Sync Queue** — força sincronização da fila
  - **Sync Settings** — força releitura das configurações
- Mostrar `params` do comando em tooltip ao passar o mouse
- Mostrar `result` quando o status for `executed` ou `failed`

### 4. MÉDIO — Painel de contas no Dashboard com status individual

Com múltiplas contas, o usuário precisa ver o status de cada uma num único lugar. Atualmente só há um seletor de conta e o badge na topbar.

**O que fazer:**
- Adicionar uma grade de "Account Cards" no topo do Dashboard (antes do LiveStatusBar)
- Cada card exibe: avatar, @username, badge online/offline, modo do bot, fila pendente, heartbeat
- Clicar no card = selecionar essa conta como ativa
- Atualizado via Realtime em `ig_accounts`

### 5. MÉDIO — Agendamento visual por dia da semana

O dashboard tem o grid de 24 horas (schedule_hours), mas não permite configurar horários diferentes por dia da semana — que é o que a extensão espera no `bot_schedule`.

**O que fazer:**
- Substituir o grid de 24 booleans por uma tabela de 7 linhas (dias) × toggle (ativo/inativo) + inputs de horário start/stop
- Converter diretamente para o formato `bot_schedule.days` esperado pela extensão:
  ```
  { mon: { active: true, start: "09:00", stop: "18:00", follows: 60, likes: 120 } }
  ```
- Adicionar campos "follows/dia" e "likes/dia" por dia para controle fino

### 6. BAIXO — Toast de "Bot voltou online"

Atualmente, `useBotOfflineAlert` detecta a transição `true → false`. Não detecta a volta `false → true`.

**O que fazer:**
- Na mesma lógica do hook `useBotOfflineAlert.ts`, adicionar detecção da transição `false → true`
- Disparar `toast.success("@username — Bot voltou online ✓")` com ícone verde

---

## O que implementar neste passo

Proposta: implementar os itens **1, 2 e 3** juntos, pois formam o núcleo de controle operacional do bot:

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard.tsx` | Botão "Sincronizar Fila" + barra de progresso da fila no KPI |
| `src/hooks/useDashboardV2.ts` | Adicionar `syncQueue()` ao hook + subscribe a UPDATE de `ig_accounts` para `queue_total`/`queue_processed` |
| `src/components/dashboard/KpiCard.tsx` | Aceitar `progress?: { current: number; total: number }` para mostrar barra |
| `src/pages/Campaigns.tsx` | Após injeção de targets, enviar `sync_queue` automaticamente |
| `src/hooks/useBotOfflineAlert.ts` | Adicionar detecção de `false → true` (bot voltou online) |

### Detalhes técnicos

**Botão Sync Queue:**
```typescript
// Em useDashboardV2.ts
const syncQueue = useCallback(async () => {
  if (!activeAccountId) return;
  const { error } = await supabase.rpc("send_bot_command", {
    p_ig_account_id: activeAccountId,
    p_command: "sync_queue",
    p_params: {},
  });
  if (error) throw error;
}, [activeAccountId]);
```

**Barra de progresso no KpiCard:**
```typescript
// Novo prop opcional em KpiCard
interface Props {
  // ... existentes
  progress?: { current: number; total: number };
}
// Renderiza <div> com width = (current/total)*100% abaixo do valor
```

**Realtime para queue_processed:**
```typescript
// Em useDashboardV2.ts — adicionar ao channel existente
.on("postgres_changes", { event: "UPDATE", schema: "public", table: "ig_accounts",
  filter: `id=eq.${activeAccountId}` }, (payload) => {
  const row = payload.new as DashboardAccount;
  setAccounts(prev => prev.map(a => a.id === row.id ? { ...a, ...row } : a));
})
```

**Auto-sync após injeção em Campanhas:**
```typescript
// No handleInject() em Campaigns.tsx — após add_targets_batch ter sucesso:
await supabase.rpc("send_bot_command", {
  p_ig_account_id: selectedId,
  p_command: "sync_queue",
  p_params: {},
});
toast.success(`${added} targets adicionados — Fila sincronizada com a extensão!`);
```

**Toast de bot voltou online:**
```typescript
// Em useBotOfflineAlert.ts
const wasOffline = !prevOnline.current[row.id];
const isNowOnline = row.bot_online === true;
if (wasOffline && isNowOnline) {
  toast.success(`@${row.ig_username} — Bot voltou online ✓`, { duration: 5000 });
}
```
