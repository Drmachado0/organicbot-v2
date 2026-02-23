

# Corrigir Cores Ilegíveis nos Badges da Página de Ações

## Problema
Os badges de tipo de ação (Follow, Like, Unfollow, Comment) e status estão com cores ilegíveis. A causa é o uso de sintaxe CSS inválida para opacidade nas cores HSL: `hsl(152 72% 48%)/15` não é CSS válido. O correto seria `hsl(152 72% 48% / 0.15)`.

## Correções em `src/pages/Actions.tsx`

### 1. Corrigir cores dos badges de tipo de ação (linhas ~178-185)

Substituir a construção inline de `style` que usa template literals quebrados:

**Antes:**
```
backgroundColor: `${ACTION_COLOR[...]}/15`,
color: ACTION_COLOR[...],
border: `1px solid ${ACTION_COLOR[...]}/30`,
```

**Depois:** Usar a função `hsl()` com canal alpha correto, por exemplo convertendo as cores para incluir alpha diretamente:

```typescript
const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  follow:   { bg: "rgba(52, 211, 153, 0.15)", text: "rgb(52, 211, 153)",  border: "rgba(52, 211, 153, 0.3)" },
  unfollow: { bg: "rgba(239, 68, 68, 0.15)",  text: "rgb(239, 68, 68)",   border: "rgba(239, 68, 68, 0.3)" },
  like:     { bg: "rgba(217, 70, 160, 0.15)", text: "rgb(217, 70, 160)",  border: "rgba(217, 70, 160, 0.3)" },
  comment:  { bg: "rgba(139, 92, 246, 0.15)", text: "rgb(139, 92, 246)",  border: "rgba(139, 92, 246, 0.3)" },
};
```

E no JSX:
```tsx
style={{
  backgroundColor: colors?.bg ?? "rgba(148, 163, 184, 0.15)",
  color: colors?.text ?? "rgb(148, 163, 184)",
  border: `1px solid ${colors?.border ?? "rgba(148, 163, 184, 0.3)"}`,
}}
```

### 2. Corrigir cores dos status (mesma abordagem)

Converter `STATUS_COLOR` para usar RGB com alpha correto, garantindo que o texto do status e o dot indicator fiquem visíveis.

### 3. Corrigir badge "novo" (linha ~199)

O badge "novo" também usa a mesma sintaxe quebrada com `hsl(... / 0.15)` inline. Converter para `rgba()`.

### Arquivos alterados
- `src/pages/Actions.tsx` - Corrigir todas as cores inline dos badges e status

