
# Sincronizar Configuracoes com o Dashboard

## Problema Identificado

O componente `ActionProgressCard` no dashboard usa limites fixos no codigo:

```text
follow: 150
unfollow: 120
like: 300
```

Quando o usuario altera esses limites na aba Configuracoes (ou aplica um preset de seguranca como "Conta Nova" com follow=40/dia), o dashboard continua exibindo os valores antigos hardcoded. A barra de progresso e a porcentagem ficam incorretas.

## Analise das Configuracoes

Todas as configuracoes da aba Settings estao sendo salvas corretamente em dois lugares:
- `user_settings.settings_json` -- armazena todos os parametros (limites, filtros, delays, schedule)
- `ig_accounts` -- recebe os campos criticos que a extensao le (delay_min, delay_max, bot_mode, likes_per_follow, max_actions_per_session, bot_schedule)

A escrita dupla (dual-write) esta funcionando. O problema e apenas que o dashboard nao le os limites salvos.

## O que sera feito

### 1. Hook `useDashboardV2` -- buscar limites do usuario

Adicionar ao `fetchAll` uma leitura de `user_settings.settings_json` para extrair `follow_daily_limit`, `unfollow_daily_limit` e `like_daily_limit`. Expor um novo campo `dailyLimits` no retorno do hook.

### 2. Componente `ActionProgressCard` -- usar limites dinamicos

Remover a constante `LIMITS` hardcoded e receber os limites como prop. Se nao houver limites configurados, usar os defaults (150/120/300) como fallback.

### 3. Dashboard page -- passar limites

Conectar o novo campo `dailyLimits` do hook ao `ActionProgressCard`.

## Detalhes Tecnicos

No hook `useDashboardV2.ts`:
- A query de `user_settings` ja existe (busca `automation_paused`), basta expandir para tambem ler `settings_json`
- Extrair os 3 limites do JSON e expor como `{ follow: number, unfollow: number, like: number }`

No componente `ActionProgressCard.tsx`:
- Adicionar prop `limits?: { follow: number; unfollow: number; like: number }`
- Usar `props.limits?.follow ?? 150` como fallback

No `Dashboard.tsx`:
- Passar `dailyLimits` do hook para o componente

Nenhuma alteracao no banco de dados e necessaria -- os dados ja estao sendo salvos corretamente pela pagina Settings.
