

# Nova Aba "Listas Salvas" na Fila de Targets

## Objetivo
Adicionar uma terceira aba na pagina `/queue` chamada **"Listas Salvas"** para guardar arquivos JSON/TXT que foram carregados, permitindo reprocessamento futuro. Cada lista salva tera um nome, data de criacao, quantidade de usernames e os dados completos.

## Como vai funcionar

1. **Nova aba "Listas Salvas"** ao lado de "Coletor" e "Leitor de Lista"
2. **Salvar lista**: Ao importar um arquivo na aba Coletor, um botao extra "Salvar lista" aparecera para guardar os dados brutos com um nome
3. **Visualizar listas salvas**: Tabela com nome, data, quantidade de usernames
4. **Acoes por lista**: Re-importar para a fila, baixar como JSON, renomear, excluir
5. **Upload direto**: Botao para fazer upload e salvar sem importar para a fila imediatamente

## Detalhes Tecnicos

### 1. Nova tabela Supabase: `saved_lists`

```sql
CREATE TABLE saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ig_account_id UUID NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '[]',
  username_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved_lists" ON saved_lists
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Mudancas em `src/pages/Queue.tsx`

- Adicionar tab "Listas Salvas" no `TabsList`
- Novo `TabsContent` com:
  - Botao de upload para salvar lista (com campo de nome)
  - Tabela listando as listas salvas com colunas: Nome, Usernames, Data, Acoes
  - Acoes: "Importar para fila", "Baixar JSON", "Renomear", "Excluir"
- No modal de importacao existente, adicionar botao "Salvar como lista" ao lado de "Importar"
- State novo: `savedLists`, `loadSavedLists()`, `savingList`
- Dialog para nomear a lista ao salvar

### 3. Fluxo do usuario

```text
Upload arquivo JSON/TXT
       |
       v
  Modal de Importacao
   /              \
  v                v
Importar       Salvar como Lista
para fila     (pede nome -> salva no DB)
                   |
                   v
            Aba "Listas Salvas"
            - Ver todas as listas
            - Re-importar quando quiser
            - Baixar / Excluir
```

### 4. Layout da aba "Listas Salvas"

- Card de upload no topo (drag-and-drop + campo de nome)
- Tabela abaixo com as listas salvas
- Cada linha: nome editavel, contagem, data relativa, botoes de acao
- Estilo consistente com o restante da pagina (dark theme, badges, etc.)

