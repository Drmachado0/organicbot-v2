

# Remover Dados Ficticios do Dashboard

## Problema

O componente `LiveStatusBar` exibe dois dados inventados que nao vem da extensao:

1. **Countdown falso** ("Proxima acao em 47s") -- um timer que decrementa localmente e reseta com valor aleatorio, sem nenhuma relacao com a extensao real
2. **Duracao de sessao falsa** ("Rodando ha Xm Xs") -- um contador que incrementa a partir de zero toda vez que a pagina carrega, sem usar dados reais de sessao

Todos os outros componentes do dashboard (KPI cards, graficos, tabelas de sessoes, log de acoes, campanhas, whitelist, alertas de saude) ja usam exclusivamente dados reais vindos do Supabase.

---

## O que muda

### Arquivo: `src/components/dashboard/LiveStatusBar.tsx`

1. **Remover o countdown ficticio** -- eliminar o estado `countdown` e o bloco "Proxima acao em Xs". Nao existe dado real da extensao para esse timer, entao ele sera removido completamente.

2. **Substituir sessao ficticia por dados reais** -- em vez de incrementar `sessionMs` localmente, usar o campo `last_heartbeat` da conta para calcular ha quanto tempo o bot esta online. Exibir "Ultimo heartbeat ha Xm" com o tempo real, ou esconder se o bot estiver offline.

3. **Remover os estados `countdown` e `sessionMs`** e o `useEffect` com `setInterval` que os alimentava.

### Resultado visual

A barra de status ficara com:
- Indicador Online/Offline (real, via `bot_online`)
- Modo atual (real, via `bot_mode`)
- Tempo desde ultimo heartbeat (real, via `last_heartbeat`)
- Badge de status da extensao (ja real)
- Username da conta (ja real)

---

## Detalhes Tecnicos

O calculo do tempo de heartbeat usara `last_heartbeat` com refresh a cada 10 segundos para manter o label atualizado:

```typescript
// Tick every 10s to update heartbeat label
const [tick, setTick] = useState(0);
useEffect(() => {
  const id = setInterval(() => setTick(t => t + 1), 10_000);
  return () => clearInterval(id);
}, []);

const heartbeatAge = account?.last_heartbeat
  ? Math.floor((Date.now() - new Date(account.last_heartbeat).getTime()) / 1000)
  : null;

function formatHeartbeatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
```

A secao "Proxima acao" sera completamente removida pois nao existe campo correspondente no banco de dados. A secao de duracao de sessao sera substituida por "Heartbeat ha X" usando dados reais.

