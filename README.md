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

As avaliações individuais continuam sendo classificações registradas pelo profissional. A avaliação familiar agora permite cálculo automático com a tabela de Coelho-Savassi enviada pelo usuário. O cálculo não faz diagnóstico e não determina prazos automaticamente. Use as categorias baixo/moderado/alto/muito alto somente se corresponderem ao protocolo adotado. Ausência de avaliação significa **não avaliado**, nunca baixo risco. A classificação familiar não é calculada pela soma dos riscos individuais.

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

## Cálculo familiar de Coelho-Savassi - tabela enviada

Use **Risco familiar** na família ou **Estratificação de risco** na ficha do paciente. Ambos abrem a mesma tabela do PDF. Se houver vínculo familiar, a avaliação é salva na família e exibida nas fichas e filtros de todos os seus membros. Sem vínculo, ela fica na ficha como avaliação familiar do domicílio; não representa risco clínico individual. Uma família de uma pessoa pode ser avaliada informando um morador. Preencha número de moradores, cômodos, saneamento e a quantidade de pessoas em cada sentinela. Não utilize a escala para classificar um paciente isolado. Informe 0 somente quando a ausência tiver sido verificada; campos ausentes não são tratados como zero.

Pesos do documento: acamado, deficiência física, deficiência mental e desnutrição grave valem 3 pontos por ocorrência informada; drogadição e desemprego valem 2; analfabetismo, menor de 6 meses, mais de 70 anos completos, hipertensão e diabetes valem 1. A quantidade verificada de pessoas em cada sentinela é multiplicada pelo peso. Uma pessoa pode estar em mais de uma sentinela. Saneamento vale 3 pontos quando presente no domicílio e é contado uma vez, assim como a relação de ocupação. Essa forma de entrada de quantidades deve ser confirmada pela equipe ao aplicar a tabela.

**Ambiguidades preservadas:** o título diz morador/cômodo, mas a definição do documento escreve cômodos divididos por moradores. Por isso, é obrigatório escolher explicitamente o sentido; nenhum é selecionado automaticamente. A escolha, o numerador, o denominador, os pesos e os subtotais ficam no registro. A relação >1 vale 3, igual a 1 vale 2 e <1 vale **1 ponto**, como no PDF recebido. Não foi substituído pelo valor 0 encontrado em outras versões da escala.

Classificação literal do documento: 5-6 pontos = R1 (risco menor), 7-8 = R2 (risco médio), acima de 9 = R3 (risco máximo). O documento não nomeia a classe dos totais abaixo de 5 e não informa uma classe para exatamente 9. A aplicação apresenta **Abaixo da faixa R1 do PDF** para valores <5, sem afirmar ausência de risco; para 9 apresenta **classificação pendente no PDF**, sem converter silenciosamente para R3. A equipe deve validar essas regras antes de usar a classificação para priorização.

O cálculo é exibido na tela e refeito pelo servidor ao salvar. Pontuação e categoria fornecidas pelo cliente são ignoradas. O histórico manual anterior é mantido e identificado, e os novos registros guardam os dados usados, detalhamento, total, interpretação de moradia, profissional responsável e usuário autenticado registrador. Campos de doenças dos cadastros não são utilizados para diagnosticar automaticamente os critérios da tabela; idade, dependência de substâncias, desemprego e as demais condições precisam ser verificadas conforme suas definições.

Fonte exata: `public/docs/coelho-savassi-tabela.pdf`, cópia do PDF fornecido pelo usuário. SHA-256: `db328d1f53a329d5bf5a39ac1c8062244d8ff30f7e52ec509598f7899dd2444b`. A avaliação registra a versão `coelho-savassi-pdf-enviado-v1` e os critérios usados, sem alterar retrospectivamente os registros antigos.

## Correções de cadastro e pesquisa (v6)

Na edição do paciente, **Remover função de responsável** retira apenas essa função. Na família, **Remover responsável** faz o mesmo. Os membros, fichas e avaliações são mantidos; a família fica com **Responsável pendente** e o cartão sinaliza a pendência. Em seguida é possível tornar outro membro responsável e desvincular a pessoa errada. Para desvincular o último cadastro, primeiro adicione o membro correto; famílias sempre mantêm pelo menos uma ficha para preservar a restrição de vínculos únicos. Enquanto a função estiver pendente, os dados de contato de cada ficha podem ser editados sem propagação. Não se apagam os endereços já registrados.

**Tabagista** foi adicionado em doenças e condições pré-existentes, com persistência na criação e edição. Não gera pontos automaticamente na escala Coelho-Savassi.

A identificação **LGBTQIAPN+** é opcional e autodeclarada, separada dos campos clínicos e do sexo. Tem respostas Sim, Não, Não informado e Prefere não informar, e várias identificações selecionáveis com nomes por extenso. Ao escolher outra resposta que não Sim, as identificações detalhadas são limpas. Não entra no cálculo de risco ou no cartão familiar compartilhável. A visualização permanece na ficha privada; a impressão individual continua sem esse campo. Referências para a sigla: https://www.gov.br/saude/pt-br/composicao/saps/equidade-em-saude/populacao-lgbtqiapn e https://observatoriodacidadania.ufms.br/en/nota-tecnica-painel-lgbtqiapn/ .

Todas as buscas de pacientes, famílias e membros normalizam maiúsculas/minúsculas e acentos. A busca de pacientes inclui outras doenças, endereço atual da família, documentos e condições verificadas: gestante/gestantes/grávida/gestação, acamado, domiciliado, criança e tabagista/fumante. Os termos “não gestante”, “não acamado” e “não domiciliado” exigem valor explicitamente falso. Vários termos devem corresponder ao mesmo cadastro; pontuação de CPF/telefone pode ser omitida. Os termos são texto literal, sem execução de expressões regulares, e não há correção arbitrária de erros de digitação.

A filtragem é feita sobre os cadastros do usuário autenticado após aplicar o contato familiar canônico, mantendo a separação por usuário e entre ativos/arquivados. O volume de leitura continua proporcional à lista do agente, como no carregamento atual; para listas muito grandes, recomenda-se indexar campos normalizados e paginar a API em uma evolução própria.
