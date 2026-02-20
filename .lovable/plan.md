

# Persistir Filtros Ativos na Fila

## Problema

Os filtros "Remover privadas", "Remover sem foto", "Remover duplicatas" na secao FILTROS ATIVOS funcionam apenas no lado do cliente (memoria). Os registros nao sao removidos do banco de dados, entao ao sair da pagina e voltar, a fila mostra todos os targets originais sem filtro.

## Solucao

Adicionar um botao **"Aplicar Filtros"** que efetivamente deleta (ou marca como `skipped`) os targets filtrados no banco de dados, tornando a alteracao permanente.

## Alteracoes

### `src/pages/Queue.tsx`

1. **Adicionar botao "Aplicar Filtros"** na secao FILTROS ATIVOS que:
   - Calcula quais targets serao removidos com base nos filtros ativos (privadas, sem foto, duplicatas, etc.)
   - Atualiza o status desses targets para `skipped` no banco (ao inves de deletar, para manter historico)
   - Mostra quantos serao removidos antes de confirmar
   - Usa um `AlertDialog` de confirmacao para evitar remocao acidental

2. **Logica de aplicacao dos filtros**:
   - Coleta os IDs dos `pendingRows` que NAO passam nos filtros ativos
   - Executa `supabase.from("target_queue").update({ status: "skipped" }).in("id", idsToRemove)`
   - Recarrega a fila apos sucesso
   - Mostra toast com quantidade removida

3. **Indicador visual**: mostrar quantos targets serao removidos ao lado do botao (ex: "Aplicar Filtros (19 removidos)")

### Detalhes tecnicos

```text
Fluxo:
[Filtros ativos] --> [Botao "Aplicar Filtros (N removidos)"]
     |
     v
[AlertDialog confirmacao] --> [UPDATE status = 'skipped' WHERE id IN (...)]
     |
     v
[loadQueue() + toast sucesso]
```

A logica de calculo dos IDs a remover reutiliza o mesmo `useMemo` existente (`filteredPendingRows`), comparando com `pendingRows` para encontrar os que foram filtrados:

```
const idsToRemove = pendingRows
  .filter(r => !filteredPendingRows.some(f => f.id === r.id))
  .map(r => r.id);
```

O botao so aparece quando `idsToRemove.length > 0`.

