

# Ajuste do Sistema de Sessao para Nao Bloquear a Extensao

## Problema
O campo `max_actions_per_session` esta limitando a extensao Chrome. Quando o limite de sessao e atingido, a extensao para e nao retoma automaticamente. Isso impede a execucao continua do bot.

## Solucao Proposta
Duas mudancas no `Settings.tsx`:

### 1. Adicionar toggle "Renovar sessao automaticamente"
- Novo campo booleano `auto_renew_session` (default: `true`)
- Quando ativado, o valor `MAX_PER_SESSION` enviado para `safety_limits` sera igual ao `MAX_PER_DAY` (efetivamente sem limite de sessao separado)
- Quando desativado, funciona como antes com `max_actions_per_session`

### 2. Alterar o valor padrao de `max_actions_per_session`
- Aumentar o default de 35 para um valor igual ao `follow_daily_limit` (sem limite de sessao por padrao)
- Os presets continuam sugerindo valores de sessao, mas o usuario pode desativar via toggle

## Mudancas Tecnicas

### `src/pages/Settings.tsx`

1. **Interface `BotSettings`** (linha 86): adicionar `auto_renew_session: boolean`

2. **`DEFAULTS`** (linha 106): adicionar `auto_renew_session: true`

3. **`parseSettings`** (linha 177): parsear `auto_renew_session` do JSON salvo

4. **Funcao `save`** (linha 945): quando `auto_renew_session === true`, enviar `MAX_PER_SESSION` com valor alto (9999) em `safety_limits`, e `max_actions_per_session` com 9999 em `ig_accounts`

5. **Aplicacao de presets** (linha 1207): quando um preset e aplicado, se `auto_renew_session` estiver ativo, o `MAX_PER_SESSION` continua sendo 9999

6. **UI do slider "Max acoes/sessao"** (linha 1378): 
   - Adicionar um toggle "Renovar sessao automaticamente" acima do slider
   - Quando ativo, o slider fica desabilitado (opacity-50) e mostra "Sem limite de sessao"
   - Quando desativado, o slider funciona normalmente

7. **`safety_limits` no save** (linha 983-988): usar `auto_renew_session ? 9999 : settings.max_actions_per_session` para `MAX_PER_SESSION`

8. **Synced fields** (linha 811): adicionar nota que `max_actions_per_session` pode ser "ilimitado" quando renovacao automatica esta ativa

### Impacto nos Presets
- Os presets continuam definindo um valor de `session` para referencia
- Mas se `auto_renew_session` estiver ativo, o valor efetivo enviado sera 9999
- A UI mostrara "Sessao: ilimitada" quando o toggle estiver ativo

### Sem mudancas no banco de dados
- O campo `max_actions_per_session` ja existe em `ig_accounts`
- O campo `auto_renew_session` sera salvo dentro de `settings_json` em `user_settings`
- `safety_limits.MAX_PER_SESSION` ja existe e sera ajustado para 9999

