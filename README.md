# ACS Cadastro

Sistema de cadastro para Agentes Comunitarios de Saude.

## Executar localmente

1. Copie `.env.example` para `.env` e informe uma URL valida do MongoDB em `MONGODB_URI`.
2. Instale as dependencias: `npm install`.
3. Inicie o servidor: `npm start`.
4. Abra `http://localhost:3000`.

## Publicacao

Este projeto possui backend em Node.js e banco MongoDB. Ele nao funciona no GitHub Pages, pois GitHub Pages publica apenas arquivos estaticos e nao executa `server.js`.

Publique o repositorio em um servico Node.js como Render ou Railway e configure a variavel de ambiente `MONGODB_URI` com a URL do MongoDB Atlas. O comando de inicio e `npm start`.
