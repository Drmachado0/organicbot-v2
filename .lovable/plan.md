

# Tooltip com horario exato do ultimo heartbeat

## O que sera feito

Adicionar um Tooltip ao indicador de tempo "Ultimo heartbeat ha..." na `LiveStatusBar`. Ao passar o mouse, o usuario vera o horario exato (ex: "14:32:05") do ultimo heartbeat.

## Detalhes Tecnicos

### Arquivo: `src/components/dashboard/LiveStatusBar.tsx`

1. Importar `Tooltip`, `TooltipTrigger`, `TooltipContent` e `TooltipProvider` de `@/components/ui/tooltip`
2. Envolver o bloco do heartbeat age (o `div` com o icone Clock e o texto "Ultimo heartbeat ha...") com os componentes de Tooltip
3. O conteudo do tooltip exibira o horario formatado com `toLocaleTimeString("pt-BR")` e a data se nao for hoje

Nenhum outro arquivo precisa ser alterado.

