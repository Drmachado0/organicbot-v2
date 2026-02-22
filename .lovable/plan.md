
# Sincronizar Presets da Pagina Extensao com Configuracoes Reais

## Problema
A pagina `/extension` mostra presets de seguranca com valores fixos (hardcoded), enquanto a pagina `/settings` permite editar esses presets e salva no banco de dados. A extensao Chrome le os valores reais do banco, entao a pagina de Extensao esta desatualizada em relacao ao que realmente esta configurado.

## Solucao
Substituir os presets hardcoded na pagina Extension por dados reais lidos de `user_settings.settings_json` e `ig_accounts`, mostrando os limites e delays que estao efetivamente configurados.

## O que muda para o usuario
- A secao "Presets de Seguranca" na pagina Extensao vai mostrar os valores reais configurados em Settings
- Se o usuario editou os presets (ex: mudou Follow de 40 para 60), a pagina Extensao reflete isso
- Tambem mostra os limites atuais da conta ativa (delay, session, etc.)

---

## Detalhes Tecnicos

### Arquivo: `src/pages/Extension.tsx`

1. **Remover o array `presets` hardcoded** (linhas 86-90)

2. **Adicionar fetch dos dados reais** no `useEffect` existente ou em um novo:
   - Buscar `user_settings.settings_json` para obter `follow_daily_limit`, `delay_min`, `delay_max`, `max_actions_per_session`, `like_daily_limit`
   - Opcionalmente buscar `ig_accounts` campos `delay_min`, `delay_max`, `max_actions_per_session` (que sao a fonte de verdade para a extensao)

3. **Exibir card unico "Configuracao Atual"** em vez dos 3 presets estaticos, mostrando:
   - Follow/dia: valor real de `follow_daily_limit`
   - Delay: `delay_min`-`delay_max`s
   - Sessao: `max_actions_per_session` acoes
   - Link para editar em Settings

4. **Manter os 3 presets como referencia** mas atualizar os valores para refletir os defaults editaveis de `DEFAULT_SAFETY_PRESETS` do Settings, e destacar visualmente qual preset esta mais proximo da configuracao atual.

### Abordagem escolhida
- Adicionar um novo estado `currentConfig` que busca do Supabase
- Mostrar um card principal com a configuracao ativa real
- Abaixo, manter os 3 presets como referencia informativa (lidos dos defaults, ou tambem do settings_json se o usuario os editou)
- Adicionar botao "Ir para Configuracoes" para editar
