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

`JWT_SECRET` é obrigatória e deve ter no mínimo 32 caracteres. A aplicação não utiliza mais uma chave pública de fallback. Gere uma chave exclusiva no seu ambiente; não use uma chave de exemplo. As variáveis de produção continuam sendo `MONGODB_URI`, `JWT_SECRET` e, quando necessário, `PORT`.

## Uso

Na primeira tela, use **Criar novo usuário e senha** para criar a conta de cada agente. Cada conta vê, cria, edita e exclui apenas os seus próprios cadastros. Os campos de criança (0 a 9 anos), sexo, gestante e doenças pré-existentes já estão disponíveis no formulário.

> Atenção: registros antigos criados antes desta versão não possuem um usuário associado. Para preservar esses dados, associe-os manualmente a uma conta no MongoDB antes de usar a nova versão em produção.

## Famílias

Cada família tem nome, responsável, número da ficha, microárea, endereço e membros. O responsável é uma pessoa cadastrada na lista do agente e já entra como membro ao criar a família.

1. Cadastre o responsável na ficha individual, se ainda não existir.
2. Em **Famílias e responsáveis**, escolha a pessoa e crie a família.
3. Abra a família e use **Vincular cadastro existente** para adicionar uma pessoa da sua lista. Informe o vínculo/parentesco com o responsável.
4. Para uma pessoa nova, use **Cadastrar novo familiar**. O formulário individual recebe o endereço do responsável como sugestão editável. Ao salvar a ficha, o sistema tenta vinculá-la à família. Se o vínculo falhar, a ficha continua salva e pode ser vinculada pela opção de cadastro existente, sem refazer o cadastro.
5. Use **Tornar responsável** para trocar o responsável por outro membro. Revise depois os vínculos em relação ao novo responsável, usando **Editar vínculo**.
6. **Desvincular** remove apenas a associação. A ficha individual e suas avaliações permanecem.

Uma pessoa só pode pertencer a uma família na lista do mesmo agente. O MongoDB protege essa regra com um índice único, inclusive em solicitações simultâneas. Não é possível remover o responsável atual: primeiro selecione outro membro como responsável. Famílias e fichas de contas diferentes não podem ser vinculadas.

Os dados de família ficam na nova coleção `familias`; os cadastros individuais existentes não são recriados ou agrupados automaticamente pelo endereço. Endereço igual, sozinho, não identifica uma família. O responsável e os membros continuam com fichas individuais independentes.

## Estratificação de risco

Use **Estratificação de risco** na ficha individual ou **Risco familiar** na família. A ficha individual permite avaliação geral, hipertensão, diabetes, cardiovascular e gestação; a família tem avaliação de vulnerabilidade familiar.

Esta versão registra a classificação realizada pelo profissional responsável. **Não calcula escores clínicos, diagnósticos ou prazos automaticamente.** O protocolo precisa ser definido e validado pela equipe antes de programar o cálculo. Use as categorias baixo/moderado/alto/muito alto somente se corresponderem ao protocolo adotado. Ausência de avaliação significa **não avaliado**, nunca baixo risco. A classificação familiar não é calculada pela soma dos riscos individuais.

Cada avaliação guarda a classificação, protocolo, versão/ano, justificativa, profissional responsável, data da avaliação e próxima avaliação definida pela equipe, quando informada. O sistema acrescenta automaticamente a data de registro e a identidade do usuário autenticado que registrou a informação. O nome do profissional que realizou a classificação é informado no formulário; a sessão identifica quem registrou, não comprova a atuação clínica desse profissional.

O histórico é acrescentado por operações atômicas, sem substituir avaliações anteriores. Uma edição comum da ficha não altera esse histórico. Para corrigir, adicione uma nova avaliação e registre o motivo. Vale a avaliação com data clínica mais recente de cada tipo; em datas iguais, vale a última registrada. Os filtros de classificação e prazo correspondem à mesma avaliação, sem combinar riscos diferentes. Os administradores do banco ainda podem alterar documentos diretamente: este histórico não é uma trilha de auditoria inviolável.

## Arquivamento e restauração

Fichas avulsas podem ser **arquivadas**, saindo da lista ativa sem apagar o documento do banco. Para recuperar, selecione **Arquivados (permite restaurar)** e use **Restaurar cadastro**. Esse cuidado mantém referências recuperáveis em operações concorrentes. O CPF continua reservado ao cadastro arquivado; restaure a ficha em vez de criar outra pessoa com o mesmo CPF.

Fichas vinculadas a uma família não podem ser arquivadas antes de serem desvinculadas. Fichas com histórico de risco têm o arquivamento bloqueado para preservar a consulta às avaliações. A aplicação não oferece exclusão de família com seus membros em cascata.

## Testes

```sh
npm ci
npm test
```

Os testes usam MongoDB temporário, dados fictícios e um servidor HTTP local. `mongodb-memory-server` baixa um binário de testes no primeiro uso, sem acessar o MongoDB de produção. A interface é exercitada com JSDOM, incluindo criar família, vincular pessoa existente, cadastrar novo familiar, registrar risco e encerrar a sessão. Isso não substitui uma inspeção visual em navegador e celular.

Antes de atualizar produção, faça backup do MongoDB, confirme `JWT_SECRET` e valide a versão com dados fictícios. O projeto não possui integração ou homologação com e-SUS APS.
