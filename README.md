# 🎥 Transcritor de Vídeos com IA

Este é um aplicativo fullstack que permite transcrever vídeos do YouTube, Instagram (simulado) e arquivos locais usando a API Whisper da OpenAI. O frontend é construído com React (Vite) e Tailwind CSS, e o backend com Node.js e Express.

## 🚀 Como Rodar Localmente

Siga estes passos para executar o projeto em sua máquina local:

1.  **Clone o repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO_GITHUB>
    cd transcriptor-videos-full
    ```

2.  **Instale as dependências:**
    Certifique-se de ter o Node.js e o npm (ou yarn/pnpm) instalados.
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    *   Copie o arquivo `.env.example` para um novo arquivo chamado `.env`.
    *   Abra o arquivo `.env` e adicione sua chave da API da OpenAI:
        ```
        OPENAI_API_KEY=sk-sua-chave-openai-aqui
        PORT=3001
        ```
    *   **Importante:** Substitua `sk-sua-chave-openai-aqui` pela sua chave real da OpenAI.

4.  **Execute o aplicativo em modo de desenvolvimento:**
    Este comando iniciará o servidor backend (com nodemon) e o servidor de desenvolvimento do frontend (Vite) simultaneamente.
    ```bash
    npm run dev
    ```

5.  **Acesse o aplicativo:**
    Abra seu navegador e acesse `http://localhost:5173` (ou a porta que o Vite indicar).

## 🌐 Passo a Passo para Publicar no Railway via GitHub

Siga estas instruções para fazer o deploy do seu aplicativo na plataforma Railway usando seu repositório GitHub:

1.  **Crie um Repositório no GitHub:**
    *   Vá para [github.com](https://github.com) e crie um novo repositório (pode ser público ou privado).
    *   **Não** inicialize o repositório com README, .gitignore ou licença, pois já temos esses arquivos.

2.  **Envie o Código para o GitHub:**
    *   No seu terminal, dentro da pasta do projeto (`transcriptor-videos-full`), inicialize o Git, adicione os arquivos, faça o commit e envie para o repositório remoto que você criou:
        ```bash
        git init -b main
        git add .
        git commit -m "Primeiro commit: Projeto Transcritor de Vídeos"
        git remote add origin <URL_DO_SEU_REPOSITORIO_GITHUB>
        git push -u origin main
        ```
    *   Substitua `<URL_DO_SEU_REPOSITORIO_GITHUB>` pela URL do seu repositório (ex: `https://github.com/seu-usuario/transcriptor-videos-full.git`).

3.  **Crie uma Conta e um Projeto no Railway:**
    *   Acesse [railway.app](https://railway.app/) e crie uma conta (você pode usar sua conta do GitHub para facilitar).
    *   No dashboard, clique em "New Project".

4.  **Conecte seu Repositório GitHub:**
    *   Escolha a opção "Deploy from GitHub repo".
    *   Autorize o Railway a acessar seus repositórios GitHub (se ainda não o fez).
    *   Selecione o repositório `transcriptor-videos-full` que você acabou de criar e enviar.

5.  **Configuração Automática (Nixpacks):**
    *   O Railway detectará automaticamente que é um projeto Node.js (graças ao `package.json`) e usará o builder Nixpacks (conforme definido em `railway.json`) para construir e implantar seu aplicativo.
    *   O comando de build (`npm run build`) e o comando de start (`npm start`) definidos no `package.json` e `railway.json` serão usados.

6.  **Configure as Variáveis de Ambiente no Railway:**
    *   Após conectar o repositório, o Railway iniciará o primeiro deploy, que provavelmente falhará ou funcionará em modo de simulação por falta da chave da API.
    *   Vá até o seu projeto no Railway, clique no serviço que foi criado (geralmente com o nome do repositório).
    *   Navegue até a aba "Variables".
    *   Adicione a variável de ambiente `OPENAI_API_KEY` com a sua chave real da OpenAI.
        *   **Nome:** `OPENAI_API_KEY`
        *   **Valor:** `sk-sua-chave-real-da-openai`
    *   O Railway automaticamente fará um novo deploy com a variável configurada.
    *   **Opcional:** Você pode adicionar a variável `PORT` se precisar especificar uma porta diferente da padrão que o Railway oferece, mas geralmente não é necessário.

7.  **Acesse seu Aplicativo:**
    *   Após o deploy ser concluído com sucesso (verifique os logs na aba "Deployments"), vá para a aba "Settings" do seu serviço.
    *   Na seção "Domains" ou "Networking", você encontrará um domínio público gerado automaticamente pelo Railway (ex: `transcriptor-videos-full-production.up.railway.app`). Clique nele para acessar seu aplicativo online!

8.  **Deploy Contínuo:**
    *   A partir de agora, sempre que você fizer um `git push` para a branch `main` do seu repositório no GitHub, o Railway automaticamente fará um novo build e deploy da versão mais recente do seu aplicativo.

## 📋 Funcionalidades

- ✅ Upload de arquivos de vídeo/áudio (até 100MB).
- ✅ Transcrição de vídeos do YouTube via URL.
- ✅ Transcrição de vídeos do Instagram via URL (atualmente simulado no backend - requer implementação de downloader específico).
- ✅ Transcrição de áudio usando a API Whisper da OpenAI.
- ✅ Interface moderna e responsiva construída com React, Vite e Tailwind CSS.
- ✅ Feedback visual durante o processamento.
- ✅ Botão para copiar facilmente a transcrição gerada.
- ✅ Backend robusto com Node.js e Express para lidar com as requisições.

## 🔧 APIs e Dependências Chave

- **OpenAI API (Whisper):** Essencial para a funcionalidade de transcrição. Requer uma chave de API válida.
- **ytdl-core:** Usado no backend para baixar o áudio de vídeos do YouTube.
- **Express:** Framework web para o backend Node.js.
- **React & Vite:** Biblioteca e ferramenta de build para o frontend.
- **Tailwind CSS:** Framework CSS para estilização.
- **Lucide Icons:** Biblioteca de ícones SVG.
- **Multer:** Middleware para lidar com upload de arquivos no Express.
- **Railway:** Plataforma de deploy.

## 💡 Observações

*   A funcionalidade de transcrição do Instagram no backend (`server.js`) está atualmente **simulada**. Para implementá-la de verdade, você precisaria integrar uma biblioteca como `instaloader` (Python) ou uma API não oficial (com os devidos cuidados éticos e legais), além de potencialmente lidar com autenticação.
*   Certifique-se de que sua chave da OpenAI está segura e não exposta no código do frontend ou em commits públicos.
*   Monitore os logs de deploy no Railway para identificar e corrigir possíveis erros durante o build ou execução.

