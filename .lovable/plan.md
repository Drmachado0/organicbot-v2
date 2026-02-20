

# Corrigir Importacao de Arquivos + Erro de Funcao Duplicada

## Problema 1: Funcao `add_targets_batch` duplicada

Existem duas versoes da funcao no banco:
- `add_targets_batch(p_ig_account_id, p_usernames, p_source)` (original, 3 parametros)
- `add_targets_batch(p_ig_account_id, p_usernames, p_source, p_campaign_id)` (nova, 4 parametros)

Quando o codigo chama sem `p_campaign_id`, o PostgreSQL nao consegue decidir qual usar e retorna o erro mostrado na screenshot.

**Solucao**: Criar uma migracao SQL para dropar a versao antiga (3 parametros), mantendo apenas a versao com `p_campaign_id` (que ja tem `DEFAULT NULL`, entao funciona sem o parametro).

```sql
DROP FUNCTION IF EXISTS public.add_targets_batch(uuid, text[], text);
```

## Problema 2: Arquivo `.txt` com conteudo JSON

O arquivo `admilhas_comentadores.txt` contem um array JSON com objetos tipo `{"username": "lago_filipe", ...}`, mas como a extensao e `.txt`, o parser trata como texto puro (um username por linha), o que nao funciona.

**Solucao**: Alterar a logica de parsing em `Queue.tsx` para detectar JSON automaticamente, independente da extensao do arquivo. Para arquivos `.txt` e `.csv`, tentar fazer `JSON.parse()` primeiro; se funcionar, usar a mesma logica de extracao de usernames do JSON.

### Alteracoes em `src/pages/Queue.tsx`

Extrair a logica de parsing em uma funcao reutilizavel `parseFileContent(text)`:

1. Tenta `JSON.parse(text)` primeiro
2. Se for array de objetos com campo `username`, extrai os usernames e salva os detalhes no `importJsonItemsRef`
3. Se falhar o parse JSON, trata como texto (um username por linha, separado por `\n` ou `,`)

Aplicar essa funcao nos dois handlers: `onDrop` e `onChange` do input file, removendo a verificacao `file.name.endsWith(".json")`.

---

## Resumo de alteracoes

| Arquivo | O que muda |
|---|---|
| Migracao SQL | `DROP FUNCTION` da versao antiga de 3 parametros |
| `src/pages/Queue.tsx` | Parser inteligente que detecta JSON em qualquer extensao de arquivo |

