
# Corrigir erro "safety_preset does not exist" que impede a extensao de rodar

## Problema encontrado

Os logs do Postgres mostram repetidamente:

```
ERROR: column ig_accounts.safety_preset does not exist
```

A extensao Chrome esta tentando ler ou gravar uma coluna `safety_preset` na tabela `ig_accounts`, mas essa coluna nunca foi criada. Isso causa falha nas queries da extensao, impedindo-a de funcionar.

Alem disso, o comando `set_safety_preset` esta listado como valido no constraint de `bot_commands`, mas nao tem utilidade pratica sem a coluna correspondente.

## O que sera feito

### 1. Adicionar a coluna `safety_preset` na tabela `ig_accounts`

Criar a coluna com valor default `'media'` (o preset intermediario), tipo `text`, nullable. Isso resolve imediatamente o erro da extensao sem precisar alterar o codigo da extensao.

```sql
ALTER TABLE public.ig_accounts
  ADD COLUMN IF NOT EXISTS safety_preset text DEFAULT 'media';
```

### 2. Atualizar o save de Settings para gravar o preset

Na pagina Settings (`src/pages/Settings.tsx`), ao salvar, tambem gravar o `safety_preset` detectado (baseado na configuracao atual) na tabela `ig_accounts`, para que a extensao possa le-lo.

### 3. Nenhuma mudanca na extensao necessaria

A extensao ja tenta ler `safety_preset` -- basta que a coluna exista para o erro parar.

---

## Detalhes tecnicos

### Migracao SQL
- `ALTER TABLE public.ig_accounts ADD COLUMN IF NOT EXISTS safety_preset text DEFAULT 'media';`

### Arquivo: `src/pages/Settings.tsx`
- Na funcao `save()`, no update de `ig_accounts` (por volta da linha 974), adicionar `safety_preset` ao objeto de update
- Calcular o preset mais proximo usando a mesma logica de `getClosestPreset` que ja existe em Extension.tsx
- Adicionar uma funcao helper `detectPreset(settings)` que retorna `'nova'`, `'media'` ou `'madura'`

### Arquivo: `src/pages/Extension.tsx`
- Na query de `ig_accounts` (linha 142), adicionar `safety_preset` no select para exibir o preset real salvo na conta (opcional, melhora visual)
