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

Na edição do paciente, **Remover função de responsável** retira apenas essa função. Na família, **Remover responsável** faz o mesmo. Os membros, fichas e avaliações são mantidos; a família fica com **Responsável pendente** e o cartão sinaliza a pendência. Em seguida é possível tornar outro membro responsável e desvincular a pessoa errada. Desde a v9, qualquer membro, inclusive o responsável ou o último cadastro, pode ser removido diretamente, sem indicar substituto. Enquanto a função estiver pendente, os dados de contato de cada ficha podem ser editados sem propagação. Não se apagam os endereços já registrados.

**Tabagista** foi adicionado em doenças e condições pré-existentes, com persistência na criação e edição. Não gera pontos automaticamente na escala Coelho-Savassi.

A identificação **LGBTQIAPN+** é opcional e autodeclarada, separada dos campos clínicos e do sexo. Tem respostas Sim, Não, Não informado e Prefere não informar, e várias identificações selecionáveis com nomes por extenso. Ao escolher outra resposta que não Sim, as identificações detalhadas são limpas. Não entra no cálculo de risco ou no cartão familiar compartilhável. A visualização permanece na ficha privada; a impressão individual continua sem esse campo. Referências para a sigla: https://www.gov.br/saude/pt-br/composicao/saps/equidade-em-saude/populacao-lgbtqiapn e https://observatoriodacidadania.ufms.br/en/nota-tecnica-painel-lgbtqiapn/ .

Todas as buscas de pacientes, famílias e membros normalizam maiúsculas/minúsculas e acentos. A busca de pacientes inclui outras doenças, endereço atual da família, documentos e condições verificadas: gestante/gestantes/grávida/gestação, acamado, domiciliado, criança e tabagista/fumante. Os termos “não gestante”, “não acamado” e “não domiciliado” exigem valor explicitamente falso. Vários termos devem corresponder ao mesmo cadastro; pontuação de CPF/telefone pode ser omitida. Os termos são texto literal, sem execução de expressões regulares, e não há correção arbitrária de erros de digitação.

A filtragem é feita sobre os cadastros do usuário autenticado após aplicar o contato familiar canônico, mantendo a separação por usuário e entre ativos/arquivados. O volume de leitura continua proporcional à lista do agente, como no carregamento atual; para listas muito grandes, recomenda-se indexar campos normalizados e paginar a API em uma evolução própria.

## Janelas de ação (v7)

As listas de pacientes e famílias permanecem na tela principal. **Novo cadastro**, **Editar**, **Criar/Editar família**, **Abrir família**, **Adicionar familiar** e **Editar vínculo** abrem diálogos nativos, assim como risco e cartão. Formulários deixam de aparecer ao final da página.

Os modais têm cabeçalho fixo com Fechar/Voltar, rolagem interna limitada à altura disponível e campos adaptados ao celular. O fundo fica inativo e com rolagem bloqueada; ao fechar a última janela, a posição original da lista é restaurada. Escape fecha a janela atual. Fechar ou cancelar cadastro descarta seu rascunho; cancelar a inclusão de um familiar não o vincula nem grava uma ficha. Fechar o modal de família não faz com que atualizações de listas o reabram.

Na família, **Adicionar familiar** abre uma janela para pesquisar alguém já cadastrado ou cadastrar uma pessoa nova com os dados do responsável. O cadastro de novo familiar abre sobre essa janela; ao cancelar, é possível retornar à seleção. Ao salvar, a janela da família mostra os membros atualizados. Edição de parentesco agora usa formulário em modal em vez de prompt. Mensagens de erro da edição/criação de família aparecem dentro do formulário. Sair encerra todas as janelas e limpa seus contextos.

O módulo `public/modais.js` centraliza abertura, fechamento, foco e bloqueio de rolagem. Não há mudanças no banco nem novas variáveis de ambiente para esta atualização. Os testes de interface usam JSDOM com diálogos simulados e verificam os fluxos e estados; não substituem validação visual em aparelhos reais.

## Responsividade e instalação PWA (v8)

Corrigido o cabeçalho dos modais: a regra móvel de botão com largura 100% espremia o título. Voltar/Fechar agora usa apenas a largura necessária e o título ocupa o espaço restante. Formulários, fieldsets, seleção de identificações, tabelas e ações respeitam a largura disponível. Em celulares, as janelas ficam no topo da área útil com rolagem interna, cabeçalho acessível e controles de pelo menos 44px. A altura usa a Visual Viewport quando disponível para acompanhar rotação e teclado; sem essa API usa a altura da janela.

**Instalação:** publique todos os arquivos na raiz do site em HTTPS (localhost também permite desenvolvimento). Abra o site e toque em **Instalar aplicativo**. No Android/Chrome, o botão usa o convite nativo quando disponível; caso contrário, mostra instruções do menu do navegador. No iPhone/Safari, use Compartilhar > Adicionar à Tela de Início. O app abre em modo standalone com nome ACS Cadastro e ícone próprio. Não requer Play Store, APK, novas variáveis de ambiente ou mudanças no banco.

O manifesto fica em `public/manifest.webmanifest`, com ícones PNG 192/512, máscara 512 e Apple 180. O SVG fonte é `public/assets/icons/acs.svg`. `pwa.js` registra o service worker, oferece instalação e avisa atualizações. O worker espera o usuário escolher **Atualizar aplicativo** antes de ativar uma nova versão; a ação pede que os formulários sejam fechados, sem recarregar rascunhos abertos automaticamente. Outros clientes abertos não são recarregados à força.

**Conexão:** o PWA continua dependendo de internet para autenticar, consultar e salvar pacientes, famílias, risco e cartões. O service worker não intercepta APIs, escritas, respostas com Authorization, scripts da aplicação ou recursos externos. Seu cache contém apenas a página pública de indisponibilidade, seu script e ícones. Se abrir sem rede, aparece uma tela de aviso, sem fichas de pacientes. Não há fila de gravação offline. Ao perder uma resposta durante salvamento, confira a ficha após reconectar antes de repetir a operação. A instalação por si só não transforma o sistema em cadastro offline.

Cabeçalhos HTTP de manifesto, HTML e service worker pedem revalidação para facilitar atualizações. Depois de enviar a versão, recarregue o site uma vez para carregar o CSS e scripts atualizados. Referências: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable e https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios .

Validação desta versão: testes automatizados de manifesto, tamanhos reais dos PNGs, isolamento do cache, fallback sem rede e interface. Também verificados os oito modais em Chromium com larguras 320, 360, 390, 430, 768, 844 (paisagem) e 1280, conferindo limites, sobreposição no cabeçalho e rolagem horizontal. O fallback offline e o retorno à aplicação com conexão foram exercitados em navegador real; essa emulação não substitui ensaio em iPhone ou Android físicos.

## Remover cadastro da família sem substituição (v9)

O botão **Remover da família** aparece em todos os membros, inclusive no responsável, e na edição de qualquer paciente vinculado. Ele remove o vínculo em uma única ação. Quando a pessoa era responsável, a função fica pendente automaticamente; não se exige que outro membro assuma. **Retirar função e manter como membro** continua disponível como ação separada.

A ficha individual, seu CPF, seus dados atuais e seus históricos continuam cadastrados. As avaliações familiares permanecem na família original. A família pode ficar sem membros, com histórico preservado, e pode receber cadastros novos ou existentes posteriormente. O cadastro removido pode ser associado a outra família. Telefone e endereço já copiados não são revertidos automaticamente a valores anteriores desconhecidos.

A retirada do membro e a limpeza da função de responsável ocorrem juntas numa atualização atômica no MongoDB, evitando responsável fora da lista em operações simultâneas. Não há exclusão de fichas ou migração de avaliações para outra família.

Para permitir várias famílias vazias mantendo a proibição de uma pessoa participar de duas famílias, `lib/indiceVinculos.js` prepara o índice único parcial `familia_membros_unicos_v2`. Ele constrói a nova proteção antes de remover o índice legado `usuarioId_1_membros.cadastroId_1`, apenas quando o nome e a definição legada esperada são confirmados. A preparação é idempotente, ocorre na conexão do servidor e é conferida antes de remover um vínculo; se a preparação falhar, a remoção não acontece. Nenhum documento é apagado. A conta MongoDB do servidor deve permitir criar/remover índices, como na configuração normal da aplicação. Não são necessárias novas variáveis.

## Exclusão de famílias vazias (v10)

Famílias sem membros exibem **Excluir família** tanto na lista quanto na janela da família. O sistema pede confirmação e nunca exclui fichas individuais. Se a família vazia não possui avaliações, seu registro é excluído. Se possui avaliações, sai da lista ativa e passa para **Arquivadas com histórico**, mantendo as avaliações para consulta em modal, sem formulário de alteração. É possível restaurar uma família arquivada.

Famílias com membros precisam ter os vínculos removidos antes da exclusão. A API confirma novamente que não há membros no momento da operação: exclusão e arquivamento usam filtros atômicos, incluindo a presença/ausência de avaliações, para preservar alterações concorrentes. Famílias arquivadas não aceitam novos vínculos nem avaliações até serem restauradas. Todas as operações exigem o mesmo usuário proprietário.

Na tela Famílias, o filtro **Mostrar famílias** inicia em **Ativas**, portanto os registros arquivados não atrapalham o trabalho diário. Os cadastros e seus dados não mudam. Documentos antigos sem o campo `arquivado` são considerados ativos. Não exige novas variáveis nem migração manual.
