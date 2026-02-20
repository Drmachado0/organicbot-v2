
# Sincronizar Fila do Dashboard com Dados Reais

## Problema

O KPI "Fila Pendente" no dashboard usa duas fontes de dados desconectadas:
- **Valor principal** (`pendingQueueCount`): conta rows com status "pending" na tabela `target_queue` -- dado real
- **Barra de progresso**: usa `ig_accounts.queue_processed` / `ig_accounts.queue_total` -- campos atualizados pela extensao que ficam defasados quando targets sao injetados via campanha ou pagina de fila

Resultado: o numero principal mostra "1" mas a barra mostra "0 de 2351 processados (0%)" porque os campos na `ig_accounts` nao foram atualizados.

## Solucao

Substituir a fonte da barra de progresso para usar contagens reais da tabela `target_queue` em vez dos campos `queue_total`/`queue_processed` da `ig_accounts`.

## Alteracoes

### 1. Hook `useDashboardV2.ts`

- Adicionar uma query extra no `fetchAll` para contar targets com status "done" na `target_queue` para a conta ativa
- Adicionar estado `queueDoneCount` ao hook
- Expor `queueTotalCount` (pending + done) e `queueDoneCount` no retorno

```text
Queries novas (em paralelo com as existentes):
- target_queue WHERE status = 'done' AND ig_account_id = X  (count)
- Reutilizar o pendingQueueCount ja existente
```

O progresso sera calculado como:
- Total = pending + done (todos os targets da fila)
- Processados = done
- Percentual = done / total

### 2. Dashboard.tsx

- Atualizar a prop `progress` do KpiCard "Fila Pendente" para usar os novos valores do hook em vez de `account.queue_processed` / `account.queue_total`

```text
Antes:  progress={{ current: account.queue_processed, total: account.queue_total }}
Depois: progress={{ current: queueDoneCount, total: queueTotalCount }}
```

### 3. Interface do Hook

- Adicionar `queueDoneCount: number` e `queueTotalCount: number` ao retorno do hook
- Remover dependencia dos campos `queue_processed`/`queue_total` da `ig_accounts` para o progresso do dashboard

Nenhuma alteracao de banco de dados necessaria -- os dados ja existem na `target_queue`.
