
# Puxar Imagem do Perfil Instagram

## Problema
O campo `profile_pic_url` esta `null` para todas as contas no banco de dados. O codigo ja exibe a foto quando o campo tem valor (ja implementado em Queue.tsx e AccountCardsPanel.tsx), mas nenhum mecanismo popula esse campo.

## Solucao
Adicionar um botao "Atualizar Foto" que envia o comando `update_profile_pic` para a extensao via RPC `send_bot_command`, e tambem adicionar uma opcao de buscar a foto diretamente via a API publica do Instagram (endpoint `/{username}/?__a=1` ou proxy) como fallback.

### Abordagem em 2 frentes:

**1. Comando para a extensao (principal)**
- Adicionar botao "Atualizar Foto" no card de perfil da pagina Queue (ao lado de "Re-detectar")
- O botao envia o comando `update_profile_pic` via `send_bot_command`
- A extensao (fora deste codigo) deve processar esse comando e fazer `UPDATE ig_accounts SET profile_pic_url = '...' WHERE id = '...'`

**2. Fallback via Supabase Edge Function**
- Criar uma edge function `fetch-profile-pic` que usa a API publica do Instagram para buscar a foto de perfil
- Endpoint: `https://www.instagram.com/api/v1/users/web_profile_info/?username={username}`
- Salva a URL retornada no campo `profile_pic_url` da tabela `ig_accounts`
- Botao "Buscar foto" como alternativa caso a extensao nao suporte o comando

### Alteracoes nos arquivos:

**`src/pages/Queue.tsx`**
- Adicionar botao "Atualizar Foto" ao lado de "Re-detectar" no card de perfil
- O botao envia `update_profile_pic` via `sendCmd`

**`src/pages/Dashboard.tsx`** (KPI card "Status da Conta")
- Incluir avatar do `account.profile_pic_url` no KPI card que mostra `@username`

**`supabase/functions/fetch-profile-pic/index.ts`** (nova edge function)
- Recebe `ig_account_id` e `username`
- Tenta buscar foto via API publica do Instagram
- Atualiza `ig_accounts.profile_pic_url`

### Detalhes tecnicos

```text
Fluxo do botao:
[Botao "Atualizar Foto"] 
     |
     +--> sendCmd("update_profile_pic") --> extensao busca e salva no DB
     |
     +--> (fallback) fetch edge function --> API Instagram --> UPDATE ig_accounts
     |
     v
[Realtime subscription atualiza UI automaticamente]
```

A UI ja tem realtime subscription no `AccountCardsPanel` (linha 47-83) que observa mudancas em `ig_accounts`, entao quando o `profile_pic_url` for atualizado no banco, a foto aparecera automaticamente sem reload.

**Nota**: A abordagem via API publica do Instagram pode ser bloqueada por rate-limiting. A via extensao e mais confiavel pois a extensao ja esta autenticada no Instagram.
