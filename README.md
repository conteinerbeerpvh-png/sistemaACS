# ACS Cadastro

Sistema de cadastro para Agentes Comunitarios de Saude.

## Executar localmente

1. Copie `.env.example` para `.env` e informe uma URL valida do MongoDB em `MONGODB_URI` e uma `JWT_SECRET` longa e exclusiva.
2. Instale as dependencias: `npm install`.
3. Inicie o servidor: `npm start`.
4. Abra `http://localhost:3000`.

## Publicacao

Este projeto possui backend em Node.js e banco MongoDB. Ele nao funciona no GitHub Pages, pois GitHub Pages publica apenas arquivos estaticos e nao executa `server.js`.

Publique o repositorio em um servico Node.js como Render ou Railway e configure a variavel de ambiente `MONGODB_URI` com a URL do MongoDB Atlas. O comando de inicio e `npm start`.

Configure também a variável de ambiente `JWT_SECRET` no Render/Railway. Ela protege as sessões de login e não deve ser enviada ao GitHub.

## Uso

Na primeira tela, use **Criar novo usuário e senha** para criar a conta de cada agente. Cada conta vê, cria, edita e exclui apenas os seus próprios cadastros. Os campos de criança (0 a 9 anos), sexo, gestante e doenças pré-existentes já estão disponíveis no formulário.

> Atenção: registros antigos criados antes desta versão não possuem um usuário associado. Para preservar esses dados, associe-os manualmente a uma conta no MongoDB antes de usar a nova versão em produção.
