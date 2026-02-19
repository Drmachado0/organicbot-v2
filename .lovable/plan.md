
## 🚀 Dashboard "Organic Pro" — Plano de Implementação

### Visão Geral
Construir um dashboard principal moderno e rico em dados para a plataforma de automação de crescimento no Instagram, com tema escuro, glass cards, gráficos interativos e atualizações em tempo real via Supabase Realtime.

---

### 1. Hook de Dados (`useDashboardV2.ts`)
- Busca paralela de todas as fontes de dados (action_log, daily_action_cache, growth_stats, target_queue, ig_accounts, session_stats, targeting_campaigns)
- Subscription em tempo real via `supabase.channel()` para novos registros em `action_log`
- Debounce de 2s no refetch do realtime para evitar sobrecarga
- Função `toggleBot()` para iniciar/pausar o bot via `user_settings`
- Seletor de conta ativa integrado

---

### 2. Componentes Individuais (`src/components/dashboard/`)

**`LiveStatusBar.tsx`**
- Banner full-width com status do bot (online/offline com dot animado)
- Modo atual (Follow / Unfollow / Mixed)
- Tempo de sessão em execução
- Countdown regressivo para próxima ação

**`ActionProgressCard.tsx`**
- 3 progress bars empilhadas: Follow, Unfollow, Like
- Percentual de uso do limite diário por tipo
- Cores distintas por ação

**`KpiCard.tsx`** (reutilizável para Fila Pendente, Taxa de Sucesso, Status da Conta)
- Número grande + label
- Badge de urgência condicional
- Delta/tendência com ícone

**`ActionsAreaChart.tsx`**
- AreaChart Recharts com 3 séries (Follow verde, Unfollow vermelho, Like rosa)
- Toggle de período: 7d / 30d / 90d
- Tooltip customizado dark-style

**`FollowersGrowthChart.tsx`**
- LineChart de seguidores dos últimos 14 dias
- Delta total + pico + média diária

**`SessionsTable.tsx`**
- Últimas 5 sessões do bot
- Colunas: Data, Duração, Follows, Erros, Taxa de Sucesso
- Coloração de linha baseada na taxa de sucesso

**`RecentActionsTable.tsx`**
- Últimas 20 ações com filtro por tipo
- Animação de entrada para novas linhas (realtime)
- Badges coloridos por tipo de ação

**`CampaignsCard.tsx`**
- Lista de campanhas ativas com nome, tipo e badge de status

**`HealthAlertsCard.tsx`**
- Alertas inteligentes (limite atingido, taxa de erro alta, fila vazia, etc.)
- Ícones de severidade (✅ / ⚠️ / 🔔)

---

### 3. Página Principal (`src/pages/Dashboard.tsx`)
- **Header**: Título + Seletor de conta + Botão Iniciar/Pausar Bot (verde pulsante quando ativo)
- **Row 1**: LiveStatusBar (full-width)
- **Row 2**: 4 KPI Cards em grid responsivo (2x2 mobile → 4 colunas desktop)
- **Row 3**: ActionsAreaChart (full-width)
- **Row 4**: FollowersGrowthChart + SessionsTable (side-by-side)
- **Row 5**: RecentActionsTable (full-width)
- **Row 6**: CampaignsCard + WhitelistCard + HealthAlertsCard (3 colunas)
- Loading com skeletons, empty state para conta não conectada, error state com toast

---

### 4. Design System Aplicado
- Tema escuro por padrão com paleta emerald/cyberpunk
- Glass cards: `backdrop-blur + ring-1 ring-border/40`
- Animações: `animate-fade-in` na entrada, `animate-ping` nos indicadores ao vivo
- Grid responsivo mobile-first (1 coluna → 2 → 4)
- Rota `/dashboard` adicionada no `App.tsx`
