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

1. Na ficha individual, marque **Responsável pela família** e use **Salvar e adicionar membros**. A família é criada com a ficha do paciente e o endereço informado, e a área de membros é aberta automaticamente. Não é necessário preencher outro cadastro do responsável.
2. Para um paciente que já existe, use **Editar**, marque a opção e salve. A mesma ficha é reaproveitada. Se já for responsável, sua família será aberta sem criar outra. Se já for membro de uma família, o sistema pede confirmação para torná-lo responsável nessa mesma família.
3. Na área de membros, pesquise alguém já cadastrado por nome, CPF ou telefone, selecione a pessoa e use **Vincular cadastro existente**. Informe o vínculo/parentesco com o responsável.
4. Para uma pessoa nova, use **Cadastrar novo familiar**. O formulário individual recebe o endereço do responsável como sugestão editável. Ao salvar a ficha, o sistema tenta vinculá-la à família. Se o vínculo falhar, a ficha continua salva e pode ser vinculada pela opção de cadastro existente, sem refazer o cadastro.
5. Use **Tornar responsável** para trocar o responsável por outro membro. Revise depois os vínculos em relação ao novo responsável, usando **Editar vínculo**.
6. **Desvincular** remove apenas a associação. A ficha individual e suas avaliações permanecem.

Uma pessoa só pode pertencer a uma família na lista do mesmo agente. O MongoDB protege essa regra com um índice único, inclusive em solicitações simultâneas. Não é possível remover o responsável atual: primeiro selecione outro membro como responsável. Famílias e fichas de contas diferentes não podem ser vinculadas.

O cadastro manual de família permanece recolhido como alternativa. Use **Editar família** para informar ou ajustar nome, número da ficha, microárea e endereço. Desmarcar um responsável existente não remove sua função: a troca exige escolher outro membro na área da família. Se o paciente for salvo e houver falha na criação da família, a tela mantém sua ficha em edição para permitir nova tentativa sem duplicá-lo.

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

## Navegação no celular

O menu fixa o acesso a **Pacientes**, **Novo cadastro** e **Famílias**. Apenas uma dessas telas é mostrada de cada vez. As listas têm cinco registros por página, e os dados clínicos individuais ficam em um bloco recolhido. Editar um paciente ou cadastrar um membro abre a tela de cadastro; salvar um responsável abre a área da família.

## Dados compartilhados da família

Telefone, endereço, número da casa e bairro seguem a ficha do responsável. Ao vincular uma pessoa, os quatro campos são copiados automaticamente, inclusive para pessoas já cadastradas. Alterações na ficha do responsável são propagadas aos membros. Os dados clínicos, CPF, nome, nascimento e histórico de cada pessoa permanecem individuais.

Na edição de um membro, os campos de contato familiar ficam bloqueados e a API utiliza os dados do responsável. Faça mudanças de telefone ou residência na ficha do responsável. Ao cadastrar um novo familiar, esses quatro campos já vêm preenchidos, mas sua identificação e condições de saúde precisam ser informadas. As consultas também usam os dados atuais do responsável para exibir famílias antigas que tenham contatos divergentes; os próximos vínculos e alterações atualizam os documentos relacionados no banco.

## Cartão da família

Cada família possui automaticamente **Cartão**, **Ver cartão**, **Baixar PDF** e **Enviar por WhatsApp**. Ao abrir a família, o cartão frente e verso é preparado com os dados atuais, sem precisar preencher outra ficha. O arquivo PDF é gerado sob autenticação; não há link público nem token em URL. O cartão não inclui doenças ou avaliações de risco.

A frente segue o modelo fornecido: Prefeitura Municipal de Porto Velho, Secretaria Municipal de Saúde, **USF NOVA FLORESTA**, data de criação da família, equipe **MONTE SINAI**, ACS **DIANA FREIRE**, responsável, endereço, número e bairro. O verso lista nome e **CPF** de todos os membros, incluindo o responsável. Os textos fixos ficam em `lib/cartaoFamilia.js`. O PDF mede 148 x 105 mm (A6 horizontal); a primeira página é a frente e a segunda é o verso. Para mais de oito membros, são acrescentados versos de continuação, sem omitir pessoas.

O PDF incorpora as fontes para manter a legibilidade em celulares e impressão. As marcas vêm de fontes oficiais, documentadas em `public/assets/FONTES.md`. A aparência segue a referência apresentada; o projeto continua sem integração ou homologação com SUS/Prefeitura.

Em dispositivos com suporte ao compartilhamento de arquivos, **Enviar por WhatsApp** abre o menu do aparelho com o PDF anexado; escolha WhatsApp e o destinatário. A escolha do aplicativo é feita pelo sistema operacional. Use HTTPS para esse recurso. Quando não houver suporte, o botão baixa o PDF e abre a conversa do telefone familiar com uma mensagem: anexe o arquivo baixado manualmente. O link do WhatsApp não consegue anexar um arquivo por conta própria. Cancelar o compartilhamento não envia mensagem. As ações de envio dependem do usuário; o sistema não dispara mensagens automaticamente.

Ao sair, o conteúdo e os arquivos temporários de cartão são removidos da sessão da interface. Não são gravados em uma pasta pública do servidor. Atualizações da família invalidam o cartão preparado na tela, gerando um PDF com os dados atuais.
