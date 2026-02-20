
# Sincronizar Configuracoes da Fila com Settings e Extensao

## Problema

A secao "Configuracoes" na pagina de Fila (/queue) tem apenas um campo "Delay entre acoes" que salva um valor `wait_after_action` isolado no `user_settings.settings_json`. Esse valor:
- Nao e lido pela extensao (a extensao le `delay_min`/`delay_max` da tabela `ig_accounts`)
- Nao reflete os valores configurados na pagina Settings
- Nao faz a escrita dupla (dual-write) para `ig_accounts`

Resultado: o usuario configura delays na Settings, mas a Queue mostra um valor diferente e desconectado.

## Solucao

Substituir a secao "Configuracoes" da Queue page por uma versao que:
1. Le os valores reais do `user_settings.settings_json` (mesma fonte que a Settings page)
2. Exibe os campos mais relevantes para o contexto de fila (delay min/max, limite de follows por dia, max acoes por sessao)
3. Ao salvar, faz a mesma escrita dupla (user_settings + ig_accounts) que a Settings page
4. Envia comando `sync_settings` para a extensao apos salvar

## Alteracoes

### 1. Pagina Queue (`src/pages/Queue.tsx`)

**Adicionar estado para configuracoes reais:**
- Carregar `settings_json` do `user_settings` ao montar (junto com o loadQueue)
- Armazenar em estado local: `delay_min`, `delay_max`, `follow_daily_limit`, `max_actions_per_session`

**Substituir secao Configuracoes (linhas 756-795):**
Trocar o campo unico "Delay entre acoes" por 4 campos inline editaveis:
- Delay min (s) -- campo numerico
- Delay max (s) -- campo numerico
- Follows/dia -- campo numerico
- Max acoes/sessao -- campo numerico

Cada campo mostra o valor atual vindo do `user_settings`.

**Botao Salvar na secao:**
Ao salvar:
1. Faz merge dos campos editados no `settings_json` existente via `upsert` em `user_settings`
2. Faz `update` nos campos correspondentes da `ig_accounts` (dual-write: `delay_min`, `delay_max`)
3. Envia comando `sync_settings` via `send_bot_command` para a extensao processar imediatamente

**Remover** o campo `delayValue` (estado local isolado) e a logica de save atual que so grava `wait_after_action`.

### 2. Nenhuma alteracao em outros arquivos

A logica de escrita dupla sera replicada inline na Queue page, seguindo o mesmo padrao da funcao `save()` em Settings.tsx. Isso garante que qualquer alteracao feita na Queue page aparece corretamente tanto na Settings page quanto na extensao.

## Fluxo apos a alteracao

```text
Usuario edita delay na Queue page
        |
        v
Salva em user_settings.settings_json (merge)
        |
        v
Atualiza ig_accounts (delay_min, delay_max) -- dual-write
        |
        v
Envia comando sync_settings para extensao
        |
        v
Extensao le ig_accounts e aplica novos valores
```

## Campos exibidos na secao Configuracoes da Queue

| Campo | Fonte | Dual-write para ig_accounts |
|---|---|---|
| Delay min (s) | settings_json.delay_min | sim (delay_min) |
| Delay max (s) | settings_json.delay_max | sim (delay_max) |
| Follows/dia | settings_json.follow_daily_limit | nao (lido do settings_json pelo dashboard) |
| Max acoes/sessao | settings_json.max_actions_per_session | sim (max_actions_per_session) |
