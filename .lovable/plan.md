

# Corrigir URL do "Abrir Dashboard" na Extensao

## Problema

O botao "Abrir Dashboard" na extensao Chrome abre uma URL antiga (provavelmente `organicpublic.lovable.app`). A URL correta e `https://organicbot.lovable.app`. Essa URL esta hardcoded no codigo da extensao no GitHub.

## Solucao

Armazenar a `dashboard_url` no banco de dados (`user_settings.settings_json`) para que a extensao leia dinamicamente. Assim, sempre que a URL mudar, basta atualizar em um lugar.

### Alteracoes

**1. Incluir `dashboard_url` no settings_json (`src/pages/Settings.tsx`)**

Na funcao `save()` e nos presets, garantir que o campo `dashboard_url: "https://organicbot.lovable.app"` seja sempre incluido no `settings_json` ao fazer upsert.

**2. Garantir `dashboard_url` no fetch inicial (`src/pages/Settings.tsx`)**

Ao carregar as settings, se `dashboard_url` nao existir no JSON, adicionar automaticamente e salvar.

**3. Migration: atualizar registros existentes**

Criar uma migration SQL que faz update em todos os `user_settings` existentes, adicionando `dashboard_url` ao `settings_json`:

```text
UPDATE user_settings 
SET settings_json = settings_json || '{"dashboard_url": "https://organicbot.lovable.app"}'::jsonb
WHERE settings_json IS NOT NULL 
  AND NOT (settings_json ? 'dashboard_url');
```

**4. Atualizar constante na Extension page**

A constante `DASHBOARD_URL` em `src/pages/Extension.tsx` ja esta correta (`https://organicbot.lovable.app`). Nenhuma alteracao necessaria nesse arquivo.

### Fluxo

```text
Usuario salva settings / clica preset
        |
        v
settings_json inclui dashboard_url
        |
        v
sync_settings enviado
        |
        v
Extensao le settings_json e usa dashboard_url para o botao "Abrir Dashboard"
```

### Resumo

| Arquivo / Recurso | Alteracao |
|---|---|
| Migration SQL | Adiciona dashboard_url aos registros existentes |
| src/pages/Settings.tsx | Inclui dashboard_url no save/preset/fetch |

**Nota importante**: A extensao Chrome (codigo no GitHub) tambem precisa ser atualizada para ler `dashboard_url` do settings_json em vez de usar URL hardcoded. Essa alteracao e feita no repositorio da extensao, fora deste projeto.

