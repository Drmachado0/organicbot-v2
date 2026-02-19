
# Nova Página: Gerenciamento de Fila (IG List Collector Clone)

## Objetivo

Criar uma página dedicada `/queue` que replica a interface do "IG List Collector" da extensão, permitindo coletar, visualizar, importar, exportar e gerenciar a fila de targets (`target_queue`) diretamente no painel web.

---

## Análise da Interface de Referência

A imagem da extensão tem:

- **2 abas**: Coletor | Leitor de Lista
- **PERFIL ATUAL**: avatar, @username, seguidores, seguindo, status do ID
- **Botões de detecção**: Re-detectar, API, Manual
- **COLETAR**: Seguidores, Seguindo, #Hashtag, Localização
- **FILA COLETADA**: contador + exportar (JSON, CSV, TXT)
- **Importar Lista / Limpar Fila**
- **FILTROS** (seção colapsável)
- **CONFIGURAÇÕES**: delay, etc.

---

## Arquitetura da Solução

```text
/queue  →  src/pages/Queue.tsx  (nova página)
           ├── Aba 1: Coletor
           │   ├── PERFIL ATUAL (conta selecionada)
           │   ├── COLETAR (enviar comandos para extensão)
           │   ├── FILA COLETADA (count + export)
           │   ├── Importar Lista (modal)
           │   ├── Limpar Fila (confirm)
           │   ├── FILTROS (colapsável)
           │   └── CONFIGURAÇÕES (delay)
           └── Aba 2: Leitor de Lista
               └── Tabela paginada com target_queue
                   (filtros: status, source, busca)
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Mudança |
|---|---|---|
| `src/pages/Queue.tsx` | Criar | Página completa com 2 abas |
| `src/App.tsx` | Editar | Adicionar rota `/queue` |
| `src/components/layout/AppSidebar.tsx` | Editar | Adicionar item de nav "Fila" com ícone |

---

## Detalhes Técnicos

### Aba 1 — Coletor

**PERFIL ATUAL**: Lê da `ig_accounts` a conta selecionada. Exibe:
- Avatar (profile_pic_url) com outline colorido (online/offline)
- @username, followers_count, following_count
- Badge de status: "ID detectado" (ig_user_id preenchido) ou "Sem ID — será buscado via API ao iniciar coleta"
- Botão "Re-detectar" → envia `send_bot_command("sync_settings")`
- Botão "API" → envia `send_bot_command("collect_via_api")`
- Botão "Manual" → abre textarea para colar usernames

**COLETAR**: 4 botões que enviam comandos ao bot via `send_bot_command()`:

```typescript
// Seguidores
send_bot_command("collect_followers", {})
// Seguindo
send_bot_command("collect_following", {})
// Hashtag
send_bot_command("collect_hashtag", { hashtag: inputValue })
// Localização
send_bot_command("collect_location", { location: inputValue })
```

**FILA COLETADA**: Mostra `count` de targets `pending` da `target_queue`. Botões de exportação:
- **JSON**: `JSON.stringify(rows)`
- **CSV**: `username,source,created_at` por linha
- **TXT**: uma linha por username

**Importar Lista**: Modal com `<textarea>` para colar usernames (um por linha). Usa `add_targets_batch()` RPC do banco. Envia `sync_queue` ao finalizar.

**Limpar Fila**: AlertDialog de confirmação → chama RPC `clear_target_queue(accountId, "pending")`.

**FILTROS** (colapsável via `useState`):
- Fonte: `manual`, `followers`, `following`, `hashtag`, `location`
- Status: `pending`, `processing`, `done`, `skipped`

**CONFIGURAÇÕES**:
- Delay entre requisições (salva em `user_settings.settings_json.wait_after_action`)

### Aba 2 — Leitor de Lista

Tabela paginada da `target_queue` com:
- Coluna: username, source (badge), status (badge colorido), priority, created_at, processed_at
- Filtros: status, source, busca por username
- Paginação: 50 por página
- Realtime: subscription em `target_queue` para `INSERT` e `UPDATE`
- Ações por linha: deletar target individual (soft delete via UPDATE status="skipped")

### Seletor de Conta

Dropdown no topo da página (igual ao de Campanhas/Actions) para selecionar a `ig_account_id` ativa.

### Realtime

Subscription em `target_queue` filtrado por `ig_account_id`:
```typescript
.on("postgres_changes", { event: "INSERT", table: "target_queue",
  filter: `ig_account_id=eq.${accountId}` }, handler)
.on("postgres_changes", { event: "UPDATE", table: "target_queue",
  filter: `ig_account_id=eq.${accountId}` }, handler)
```

---

## Visual — Fidelidade com a Extensão

| Elemento da extensão | Implementação no painel |
|---|---|
| Fundo escuro, bordas sutis | `glass-card` + dark theme existente |
| Abas "Coletor / Leitor de Lista" | `Tabs` do Radix UI |
| Botões azuis de ação | `Button` com `bg-blue-600` (seguindo o estilo da extensão) |
| Badges JSON/CSV/TXT | `Button` variant `outline` com cor verde |
| Seção FILTROS colapsável | `Collapsible` do Radix UI |
| Counter "0 contas na fila" | número grande + label abaixo |
| Botão "Limpar Fila" vermelho | `Button variant="destructive"` |

---

## Sidebar

Adicionar entre "Log de Ações" e "Extensão":
```typescript
{ to: "/queue", icon: ListOrdered, label: "Fila de Targets" }
```
