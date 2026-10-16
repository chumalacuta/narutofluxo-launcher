# Fluxo Launcher

Launcher oficial do NarutoFluxo, baseado no [Helios Launcher](https://github.com/dscalzi/HeliosLauncher).

## Jogar

Baixe o instalador Windows x64 na página [Releases](https://github.com/chumalacuta/narutofluxo-launcher/releases/latest), instale e escolha entrar com nick ou com uma conta Microsoft que tenha Minecraft Java.

O pacote inclui Forge 1.7.10, os mods e os recursos do cliente. Na primeira execução, o launcher confere os arquivos, instala o que faltar e obtém os arquivos oficiais do Minecraft e o Java 8 quando necessário. A conexão está configurada para `181.214.48.21:10101`.

As atualizações do aplicativo e do modpack são distribuídas juntas pelo instalador de cada versão. Configurações pessoais existentes são preservadas. Mods anteriormente gerenciados pelo launcher que saírem do pacote ficam guardados em `mods-anteriores`, na pasta de dados do launcher. Arquivos adicionados manualmente pelo jogador não são removidos.

## Manutenção

Requisitos: Windows x64, Node.js 24, Python 3 e GitHub CLI autenticado na conta responsável pelo projeto.

1. Atualize a instalação de referência do Technic e teste o cliente.
2. Execute `npm ci`.
3. Defina `FLUXO_CLIENT_DIR` se a referência não estiver em `%APPDATA%/.technic/modpacks/narutofluxo`.
4. Execute `npm run prepare:pack`, `npm test` e `npm run verify:pack`. O cache de recursos do Et Futurum é obtido de `%APPDATA%/.technic/assets/asset_director`; abra a referência ao menos uma vez antes de empacotar.
5. Aumente a versão com `npm version patch --no-git-tag-version` e gere com `npm run dist:win -- --publish never`.
6. Publique uma release com a mesma versão, incluindo o `.exe`, o `.exe.blockmap` e `latest.yml` gerados em `dist`. Os três arquivos devem pertencer à mesma compilação.

O pacote gerado em `bundle` contém apenas arquivos do cliente necessários ao modpack. Saves, contas, tokens, screenshots, logs, caches de jogadores e texturas desativadas não fazem parte da distribuição. O pacote de conteúdo acompanha o instalador; não é versionado no Git.

`fluxo-settings.json` centraliza servidor, repositório, feed de atualizações e ID público do aplicativo Microsoft. A autenticação Microsoft depende de um aplicativo registrado e aprovado para as APIs do Minecraft; o ID herdado do projeto foi preservado e o login completo precisa ser validado com uma conta real. Veja `docs/MicrosoftAuth.md`.

O código do launcher mantém os créditos e a licença MIT do Helios em `LICENSE.txt`. Mods e recursos mantêm seus próprios autores e licenças.
