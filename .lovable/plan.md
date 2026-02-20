

# Persistencia de Progresso na Fila + Vinculo com Campanhas

## Contexto Atual

- A `target_queue` tem os status: `pending` -> `injected` -> `done`/`skipped`
- Atualmente todos os 2.351 targets estao como `injected`, mas nenhum como `done`
- Nao ha vinculo entre targets e campanhas — quando a extensao processa, nao sabe qual campanha originou o target
- Se a extensao parar, nao ha como retomar do ultimo target processado

## Alteracoes Propostas

### 1. Adicionar coluna `campaign_id` na `target_queue`

Vincula cada target a campanha de origem para que a extensao saiba quais configuracoes aplicar.

```text
ALTER TABLE target_queue ADD COLUMN campaign_id uuid REFERENCES targeting_campaigns(id) ON DELETE SET NULL;
```

### 2. Criar RPC `mark_targets_done` para a extensao

A extensao chama esta funcao apos processar cada target, marcando como `done` com timestamp. Isso permite retomar de onde parou.

```text
CREATE FUNCTION mark_targets_done(p_ig_account_id uuid, p_target_ids uuid[])
  -- Marca os targets como 'done' com processed_at = now()
  -- Atualiza queue_processed na ig_accounts
```

### 3. Criar RPC `fetch_next_targets` (versao melhorada)

Retorna os proximos targets a processar (status `pending` ou `injected`), incluindo dados da campanha vinculada para a extensao aplicar as configuracoes corretas.

```text
CREATE FUNCTION fetch_next_targets(p_ig_account_id uuid, p_limit int DEFAULT 50)
RETURNS TABLE (id, username, source, campaign_id, campaign_name, campaign_niche, ...)
  -- Retorna targets pendentes/injected com JOIN na campanha
  -- Ordenados por priority DESC, created_at ASC
```

### 4. Atualizar `add_targets_batch` para aceitar `campaign_id`

Quando targets sao injetados de uma campanha, salvar o `campaign_id` junto.

```text
-- Novo parametro: p_campaign_id uuid DEFAULT NULL
-- INSERT inclui campaign_id = p_campaign_id
```

### 5. Atualizar a constraint de comandos no `bot_commands`

Adicionar novos comandos que a extensao precisara: `mark_done`, `fetch_targets`.

### 6. Atualizar pagina de Campanhas (`src/pages/Campaigns.tsx`)

Na funcao `handleInject` do `InjectModal`, passar o `campaign_id` ao injetar targets para que fiquem vinculados a campanha.

### 7. Atualizar pagina de Fila (`src/pages/Queue.tsx`)

- Mostrar coluna "Campanha" na tabela de targets
- Exibir progresso por campanha (quantos processados vs total)

### 8. Atualizar Dashboard (`useDashboardV2.ts`)

- Exibir progresso real da fila baseado em `done` vs total (ja existe `queue_processed`/`queue_total` mas nao esta sendo atualizado corretamente)

## Fluxo Atualizado

```text
Campanha criada com concorrentes
        |
        v
"Injetar Targets" -> add_targets_batch(campaign_id)
        |
        v
target_queue: status=pending, campaign_id=X
        |
        v
Extensao: fetch_next_targets() -> recebe targets + config da campanha
        |
        v
Extensao processa target (follow/like/etc)
        |
        v
Extensao: mark_targets_done([target_id])
        |
        v
target_queue: status=done, processed_at=now()
        |
        v
ig_accounts.queue_processed atualizado
        |
        v
Se extensao parar e reiniciar -> fetch_next_targets() retorna apenas os pendentes
```

## Resumo de Arquivos

| Recurso | Alteracao |
|---|---|
| Migration SQL | Adicionar `campaign_id` na `target_queue`, criar RPCs `mark_targets_done` e `fetch_next_targets`, atualizar `add_targets_batch` |
| `src/pages/Campaigns.tsx` | Passar `campaign_id` ao injetar targets |
| `src/pages/Queue.tsx` | Mostrar campanha na tabela, progresso por campanha |
| `src/hooks/useDashboardV2.ts` | Ajustar KPIs de progresso da fila |

**Nota**: A extensao Chrome precisa ser atualizada separadamente para chamar `fetch_next_targets` ao iniciar e `mark_targets_done` apos cada acao.

