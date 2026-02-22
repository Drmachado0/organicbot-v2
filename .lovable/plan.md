

# Atualizar Pagina da Extensao para Sincronizar com Organic Pro

## Resumo

A pagina da Extensao (`/extension`) ainda usa o nome antigo "Organic Automator" no subtitulo, enquanto o resto do app (sidebar, login) ja usa "Organic Pro". Alem disso, o aviso sobre URL antiga pode ser simplificado ja que a URL correta (`https://organicbot.lovable.app`) ja esta configurada.

## Alteracoes

### 1. `src/pages/Extension.tsx` -- Atualizar branding

- **Linha 138**: Trocar `"Organic Automator — integração com o Instagram"` por `"Organic Pro — integração com o Instagram"`
- O `DASHBOARD_URL` ja esta correto (`https://organicbot.lovable.app`), nao precisa mudar

### 2. `src/pages/Settings.tsx` -- Verificar consistencia

- As referencias a `dashboard_url: "https://organicbot.lovable.app"` nas linhas 958 e 1176 ja estao corretas
- O campo `dont_unfollow_non_organicbot` e um nome de campo no banco de dados e nao deve ser renomeado (quebraria a extensao)

## O que NAO precisa mudar

- **`DASHBOARD_URL`** -- ja aponta para `https://organicbot.lovable.app` (URL publicada correta)
- **`ZIP_URL`** -- continua apontando para o repositorio GitHub correto
- **Campos do banco** (`dont_unfollow_non_organicbot`) -- sao nomes tecnicos que a extensao Chrome le diretamente; renomear quebraria a sincronizacao
- **Sidebar e Auth** -- ja usam "Organic Pro"

## Detalhes Tecnicos

A unica alteracao necessaria e trocar o texto "Organic Automator" por "Organic Pro" no subtitulo do header da pagina Extension. E uma mudanca de uma linha.

