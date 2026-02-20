
# Adicionar Filtros "TIPO DE CONTA" na Seção de Filtros

## Objetivo

Replicar a seção "TIPO DE CONTA" do IG List Collector na area de filtros colapsavel da aba Coletor, com checkboxes para filtrar targets na fila com base nas propriedades do perfil armazenadas na coluna `details` (JSON) da `target_queue`.

---

## O que muda

### Arquivo: `src/pages/Queue.tsx`

1. **Importar `Checkbox`** do `@/components/ui/checkbox`

2. **Novos estados para os filtros de tipo de conta:**
   - `removePrivate` (boolean) - Remover contas privadas
   - `removePublic` (boolean) - Remover contas publicas
   - `removeVerified` (boolean) - Remover verificadas
   - `removeUnverified` (boolean) - Remover nao-verificadas
   - `removeNoPhoto` (boolean) - Remover sem foto de perfil
   - `removeDuplicates` (boolean, default: true) - Remover duplicadas

3. **Adicionar seção "TIPO DE CONTA" dentro do `CollapsibleContent` dos FILTROS**, antes dos filtros de Fonte e Status existentes. Layout:
   - Titulo "TIPO DE CONTA" em uppercase
   - 6 checkboxes com labels, usando o componente `Checkbox` do Radix UI
   - Visual escuro com bordas sutis, seguindo o padrao da extensao

4. **Aplicar filtros client-side** na lista `pendingRows` e na contagem. Os filtros atuam sobre o campo `details` (JSON) de cada `TargetRow`:
   - `is_private === true` -> removido se `removePrivate` ativo
   - `is_private === false` -> removido se `removePublic` ativo
   - `is_verified === true` -> removido se `removeVerified` ativo
   - `is_verified === false` -> removido se `removeUnverified` ativo
   - `profile_pic_url` vazio/default -> removido se `removeNoPhoto` ativo
   - Duplicatas por username -> removido se `removeDuplicates` ativo

5. **Atualizar `TargetRow` interface** para incluir `details` (JSON) e **atualizar o `loadQueue` select** para incluir `details`

6. **Atualizar a logica de importacao JSON** para salvar os metadados do perfil (`is_private`, `is_verified`, `profile_pic_url`, `full_name`, `id`) na coluna `details` ao importar arquivos no formato do IG List Collector

---

## Detalhes Tecnicos

### Estrutura do `details` JSON (vindo do IG List Collector)
```typescript
{
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  full_name: string;
  id: string;
  followed_by_viewer: boolean;
}
```

### Funcao de filtro aplicada aos rows
```typescript
function applyAccountFilters(rows: TargetRow[]): TargetRow[] {
  let filtered = rows;
  if (removeDuplicates) {
    const seen = new Set<string>();
    filtered = filtered.filter(r => {
      const key = r.username.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (removePrivate) filtered = filtered.filter(r => !(r.details as any)?.is_private);
  if (removePublic) filtered = filtered.filter(r => (r.details as any)?.is_private !== false);
  if (removeVerified) filtered = filtered.filter(r => !(r.details as any)?.is_verified);
  if (removeUnverified) filtered = filtered.filter(r => (r.details as any)?.is_verified !== false);
  if (removeNoPhoto) filtered = filtered.filter(r => {
    const url = (r.details as any)?.profile_pic_url ?? "";
    return url && !url.includes("default");
  });
  return filtered;
}
```

### Importacao JSON atualizada
Ao importar um arquivo `.json` no formato do IG List Collector, alem de extrair o `username`, salvar o objeto inteiro como `details` na chamada RPC ou insert, permitindo que os filtros funcionem imediatamente apos a importacao.
