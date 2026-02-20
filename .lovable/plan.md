
# Corrigir "Atualizar Foto" - Usar Edge Function Diretamente

## Problema
A extensao nao reconhece o comando `update_profile_pic` (retorna "Comando desconhecido"). O botao atual envia o comando via `send_bot_command`, que depende da extensao processar -- mas ela nao suporta esse comando.

## Solucao
Alterar o botao "Atualizar Foto" para chamar diretamente a edge function `fetch-profile-pic` ao inves de enviar um comando para a extensao. A edge function ja existe e funciona: busca a foto via API publica do Instagram e atualiza o banco.

## Alteracoes

### `src/pages/Queue.tsx`
- Criar uma funcao `fetchProfilePic` que chama `supabase.functions.invoke("fetch-profile-pic", { body: { ig_account_id, username } })`
- Alterar o botao "Atualizar Foto" (linha 674) para chamar `fetchProfilePic` ao inves de `sendCmd("update_profile_pic")`
- Tratar erro/sucesso com toast
- O realtime ja cuidara de atualizar a foto na UI quando o banco for atualizado

### Detalhes Tecnicos

```text
Fluxo corrigido:
[Botao "Atualizar Foto"]
     |
     v
supabase.functions.invoke("fetch-profile-pic", { ig_account_id, username })
     |
     v
Edge Function busca foto via API Instagram --> UPDATE ig_accounts
     |
     v
Realtime subscription atualiza UI automaticamente
```

A funcao `fetchProfilePic` usara o `accountId` e `selectedAccount.ig_username` ja disponiveis no componente. O loading state pode reutilizar `loadingCmd` com valor `"update_profile_pic"` para manter consistencia visual.
