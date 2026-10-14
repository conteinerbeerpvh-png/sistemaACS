const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { criarApp } = require('../server');
const Cadastro = require('../models/cadastro');
const Familia = require('../models/familia');
let mongo, server, url, dom;
const secret = 'segredo-de-teste-da-interface-com-no-minimo-32-caracteres';
const agente = { id: new mongoose.Types.ObjectId().toString(), nome: 'Agente Fictício', usuario: 'teste-interface' };
const pasta = path.join(__dirname, '../public');
const alertas = [];
const erros = [];
const arquivosCompartilhados = [];
const downloads = [];
const conversas = [];
let responsavel, existente;

async function esperar(condicao, descricao) {
    for (let i = 0; i < 200; i++) {
        if (await condicao()) return;
        await new Promise(r => setTimeout(r, 20));
    }
    throw new Error('Tempo esgotado: ' + descricao);
}
before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([Cadastro.init(), Familia.init()]);
    const base = { usuarioId: agente.id, dataNascimento: '1990-01-01', endereco: 'Rua Fictícia', numero: '10', bairro: 'Bairro Fictício', telefone: '00000000000', sexo: 'F', criancaDeZeroANove: false, gestante: false };
    responsavel = await Cadastro.create({ ...base, nomeCompleto: 'Responsável Fictício', cpf: '00000000001' });
    existente = await Cadastro.create({ ...base, nomeCompleto: 'Membro Existente', cpf: '00000000002' });
    server = criarApp({ jwtSecret: secret }).listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    url = `http://127.0.0.1:${server.address().port}`;
    dom = new JSDOM(fs.readFileSync(path.join(pasta, 'index.html'), 'utf8'), { url, runScripts: 'outside-only' });
    dom.window.fetch = (rota, options) => fetch(new URL(rota, url), options);
    dom.window.AbortController = AbortController;
    dom.window.alert = m => alertas.push(m);
    dom.window.confirm = () => true;
    dom.window.scrollTo = () => {};
    dom.window.URL.createObjectURL = () => 'blob:cartao-teste';
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.navigator.canShare = () => true;
    dom.window.navigator.share = async dados => { arquivosCompartilhados.push(dados); };
    dom.window.open = (...args) => { conversas.push(args); return null; };
    dom.window.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push(this.download); };
    dom.window.addEventListener('error', e => erros.push(e.message));
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    dom.window.localStorage.setItem('acs_token', jwt.sign(agente, secret));
    dom.window.localStorage.setItem('acs_usuario', JSON.stringify({ nome: agente.nome, usuario: agente.usuario }));
    for (const arquivo of ['risco.js', 'script.js', 'organizacao.js', 'cartao.js', 'coelho-savassi.js', 'coelho-formulario.js']) vm.runInContext(fs.readFileSync(path.join(pasta, arquivo), 'utf8'), dom.getInternalVMContext(), { filename: arquivo });
    await esperar(() => dom.window.document.querySelectorAll('#familiaResponsavel option').length === 3, 'carregar responsáveis');
});
after(async () => {
    if (server) await new Promise(r => server.close(r));
    if (dom) dom.window.close();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
});
const elemento = id => dom.window.document.getElementById(id);
const enviar = id => elemento(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

test('interface cria família e vincula pessoa existente', async () => {
    dom.window.document.querySelector('[data-tela="familias"]').click();
    elemento('familiaCadastroManual').open = true;
    elemento('familiaNome').value = 'Família de Teste';
    elemento('familiaFicha').value = '123';
    elemento('familiaResponsavel').value = responsavel.id;
    elemento('familiaResponsavel').dispatchEvent(new dom.window.Event('change'));
    assert.match(elemento('familiaEndereco').value, /Rua Fictícia/);
    enviar('familiaForm');
    await esperar(() => elemento('membroExistente'), 'abrir família criada');
    await esperar(() => !elemento('salvarFamilia').disabled, 'concluir gravação da família');
    elemento('membroExistente').value = existente.id;
    elemento('membroParentesco').value = 'Cônjuge';
    elemento('vincularMembro').click();
    await esperar(() => elemento('familiaDetalhe').querySelectorAll('.membro-item').length === 2, 'vincular cadastro');
    assert.equal(await Cadastro.countDocuments({}), 2);
    assert.equal((await Familia.findOne({})).membros.length, 2);
});

test('novo familiar herda endereço e é vinculado depois de salvar, sem duplicar responsável', async () => {
    elemento('membroParentesco').value = 'Filho';
    elemento('novoMembro').click();
    assert.match(elemento('formTitle').textContent, /Novo familiar/);
    assert.equal(elemento('endereco').value, 'Rua Fictícia');
    assert.equal(elemento('numero').value, '10');
    assert.equal(elemento('telefone').value, responsavel.telefone);
    for (const [id, valor] of Object.entries({ nomeCompleto: 'Novo Familiar Fictício', dataNascimento: '01/01/2010', cpf: '000.000.000-03', telefone: '(00) 00000-0000', sexo: 'M', criancaDeZeroANove: 'false', gestante: 'false', acamado: 'false', domiciliado: 'false' })) elemento(id).value = valor;
    enviar('cadastroForm');
    await esperar(() => elemento('familiaDetalhe').querySelectorAll('.membro-item').length === 3, 'salvar novo familiar e vínculo');
    await esperar(() => !elemento('submitBtn').disabled, 'concluir gravação da ficha');
    assert.equal(await Cadastro.countDocuments({}), 3);
    const familiar = await Cadastro.findOne({ nomeCompleto: 'Novo Familiar Fictício' });
    const familia = await Familia.findOne({});
    assert.equal(familia.membros.find(m => String(m.cadastroId) === familiar.id).parentesco, 'Filho');
});

test('cadastro individual abre tabela do PDF, salva na família e filtra pelo risco compartilhado', async () => {
    const botao = elemento('cadastrosList').querySelector(`[data-risco="${responsavel.id}"]`);
    assert.ok(botao); botao.click();
    await esperar(() => elemento('coelhoDialog').open, 'abrir tabela pelo paciente');
    for (const [id, valor] of Object.entries({ coelhoMoradores: '3', coelhoComodos: '3', coelhoSentido: 'moradores_por_comodo_titulo', coelhoSaneamento: 'true', coelhoProfissional: 'Profissional de Teste', coelhoFuncao: 'Enfermeiro' })) elemento(id).value = valor;
    for (const input of elemento('coelhoSentinelas').querySelectorAll('input')) input.value = '0';
    elemento('coelhoForm').dispatchEvent(new dom.window.Event('input'));
    assert.match(elemento('coelhoResultado').textContent, /5 pontos/);
    elemento('coelhoConfirmacao').checked = true; enviar('coelhoForm');
    await esperar(() => !elemento('salvarCoelho').disabled, 'salvar e atualizar fichas');
    assert.match(elemento('coelhoMensagem').textContent, /salva/);
    assert.equal((await Cadastro.findById(responsavel.id)).avaliacoesRisco.length, 0);
    assert.equal((await Familia.findOne({ responsavelId: responsavel.id })).avaliacoesRisco.at(-1).coelhoSavassi.score, 5);
    elemento('filtroRiscoNivel').value = 'r1'; elemento('filtroRiscoNivel').dispatchEvent(new dom.window.Event('change'));
    assert.equal(elemento('cadastrosList').querySelectorAll('.cadastro-item').length, 3);
    elemento('fecharCoelho').click();
});

test('marcar responsável no novo paciente cria família e abre membros; editar reaproveita a mesma família', async () => {
    elemento('filtroRiscoNivel').value = ''; elemento('filtroRiscoNivel').dispatchEvent(new dom.window.Event('change'));
    elemento('cancelBtn').click();
    for (const [id, valor] of Object.entries({ nomeCompleto: 'Responsável pelo Cadastro', dataNascimento: '01/01/1990', cpf: '000.000.000-04', telefone: '(00) 00000-0000', sexo: 'M', criancaDeZeroANove: 'false', gestante: 'false', acamado: 'false', domiciliado: 'false', endereco: 'Rua do Responsável', numero: '2', bairro: 'Bairro Teste' })) elemento(id).value = valor;
    elemento('responsavelFamilia').checked = true;
    elemento('responsavelFamilia').dispatchEvent(new dom.window.Event('change'));
    assert.equal(elemento('submitBtn').textContent, 'Salvar e adicionar membros');
    enviar('cadastroForm');
    await esperar(() => !elemento('submitBtn').disabled, 'criar responsável e abrir membros');
    const pessoa = await Cadastro.findOne({ nomeCompleto: 'Responsável pelo Cadastro' });
    assert.ok(pessoa);
    assert.equal(await Cadastro.countDocuments({}), 4);
    assert.equal(await Familia.countDocuments({}), 2);
    const familia = await Familia.findOne({ responsavelId: pessoa._id });
    assert.equal(familia.membros.length, 1);
    assert.match(elemento('familiaDetalhe').textContent, /Família de Responsável pelo Cadastro/);
    assert.equal(dom.window.document.activeElement.id, 'membroBusca');
    elemento('cadastrosList').querySelector(`[data-editar="${pessoa.id}"]`).click();
    assert.equal(elemento('responsavelFamilia').checked, true);
    enviar('cadastroForm');
    await esperar(() => !elemento('submitBtn').disabled, 'editar responsável existente');
    assert.equal(await Familia.countDocuments({}), 2);
    assert.equal(await Cadastro.countDocuments({}), 4);
});

test('editar paciente antigo e marcar responsável reaproveita ficha; pesquisa membro por nome sem acento e CPF', async () => {
    const base = { usuarioId: agente.id, dataNascimento: '1990-01-01', endereco: 'Rua Teste', numero: '1', bairro: 'Teste', telefone: '00000000000', sexo: 'F', criancaDeZeroANove: false, gestante: false };
    const antigo = await Cadastro.create({ ...base, nomeCompleto: 'Paciente Antigo', cpf: '000.000.000-05' });
    const membro = await Cadastro.create({ ...base, nomeCompleto: 'Pessoa Buscável', cpf: '000.000.000-06' });
    await dom.window.buscarCadastros(); await dom.window.carregarOrganizacao();
    elemento('cadastrosList').querySelector(`[data-editar="${antigo.id}"]`).click();
    assert.equal(elemento('responsavelFamilia').checked, false);
    elemento('responsavelFamilia').checked = true; enviar('cadastroForm');
    await esperar(() => !elemento('submitBtn').disabled, 'criar família pela edição');
    assert.equal(await Cadastro.countDocuments({}), 6);
    const familia = await Familia.findOne({ responsavelId: antigo._id }); assert.ok(familia);
    elemento('membroBusca').value = 'buscavel'; elemento('membroBusca').dispatchEvent(new dom.window.Event('input'));
    assert.equal(elemento('membroExistente').options.length, 2);
    assert.equal(elemento('membroExistente').options[1].value, membro.id);
    elemento('membroBusca').value = '00000000006'; elemento('membroBusca').dispatchEvent(new dom.window.Event('input'));
    assert.equal(elemento('membroExistente').options[1].value, membro.id);
    elemento('membroExistente').value = membro.id; elemento('membroParentesco').value = 'Filho'; elemento('vincularMembro').click();
    await esperar(() => elemento('familiaDetalhe').querySelectorAll('.membro-item').length === 2, 'vincular resultado da pesquisa');
    assert.equal(await Cadastro.countDocuments({}), 6);
});

test('falha ao criar família permite repetir salvamento sem duplicar paciente', async () => {
    elemento('cancelBtn').click();
    for (const [id, valor] of Object.entries({ nomeCompleto: 'Responsável com Nova Tentativa', dataNascimento: '01/01/1990', cpf: '000.000.000-07', telefone: '(00) 00000-0000', sexo: 'M', criancaDeZeroANove: 'false', gestante: 'false', acamado: 'false', domiciliado: 'false', endereco: 'Rua Teste', numero: '2', bairro: 'Teste' })) elemento(id).value = valor;
    elemento('responsavelFamilia').checked = true;
    const fetchOriginal = dom.window.fetch;
    let falhou = false;
    dom.window.fetch = (rota, opcoes) => {
        if (!falhou && rota === '/api/familias' && opcoes.method === 'POST') {
            falhou = true;
            return Promise.resolve(new Response(JSON.stringify({ message: 'Falha simulada da família' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
        }
        return fetchOriginal(rota, opcoes);
    };
    enviar('cadastroForm');
    await esperar(() => !elemento('submitBtn').disabled, 'tratar falha da família');
    assert.equal(await Cadastro.countDocuments({}), 7);
    assert.equal(alertas.length, 1); assert.match(alertas[0], /já foi salva/); alertas.length = 0;
    assert.equal(elemento('responsavelFamilia').checked, true);
    dom.window.fetch = fetchOriginal;
    enviar('cadastroForm');
    await esperar(() => !elemento('submitBtn').disabled, 'repetir vínculo com ficha existente');
    assert.equal(await Cadastro.countDocuments({}), 7);
    const pessoa = await Cadastro.findOne({ nomeCompleto: 'Responsável com Nova Tentativa' });
    assert.ok(await Familia.findOne({ responsavelId: pessoa._id }));
});

test('menu mostra uma tela por vez e listas de pacientes são paginadas', async () => {
    dom.window.document.querySelector('[data-tela="pacientes"]').click();
    assert.equal(dom.window.document.querySelectorAll('[data-panel]:not([hidden])').length, 1);
    assert.equal(dom.window.document.querySelector('[data-panel="pacientes"]').hidden, false);
    elemento('filtroRiscoNivel').value = ''; elemento('filtroRiscoNivel').dispatchEvent(new dom.window.Event('change'));
    await dom.window.buscarCadastros();
    assert.equal(elemento('cadastrosList').querySelectorAll('.cadastro-item').length, 5);
    assert.match(elemento('pacientesPaginacao').textContent, /Página 1 de 2/);
    [...elemento('pacientesPaginacao').querySelectorAll('button')].find(b => b.textContent === 'Próxima').click();
    assert.equal(elemento('cadastrosList').querySelectorAll('.cadastro-item').length, 2);
    dom.window.document.querySelector('[data-tela="familias"]').click();
    assert.equal(dom.window.document.querySelectorAll('[data-panel]:not([hidden])').length, 1);
});

test('cartão é preparado automaticamente, mostra frente e verso e compartilha PDF pelo menu do celular', async () => {
    await esperar(() => elemento('whatsappCartao') && !elemento('whatsappCartao').disabled, 'preparar PDF da família');
    elemento('verCartao').click();
    await esperar(() => elemento('cartaoDialog').open, 'abrir cartão');
    assert.equal(elemento('cartaoVisual').querySelectorAll('.cartao-face').length, 2);
    assert.match(elemento('cartaoVisual').textContent, /MONTE SINAI/); assert.match(elemento('cartaoVisual').textContent, /DIANA FREIRE/);
    assert.match(elemento('cartaoVisual').textContent, /CPF/);
    elemento('fecharCartao').click(); elemento('whatsappCartao').click();
    await esperar(() => arquivosCompartilhados.length === 1, 'compartilhar arquivo');
    assert.equal(arquivosCompartilhados[0].files[0].type, 'application/pdf');
    assert.match(arquivosCompartilhados[0].files[0].name, /\.pdf$/);
    await esperar(() => !elemento('whatsappCartao').disabled, 'concluir compartilhamento');
});

test('quando o aparelho não compartilha arquivos, baixa PDF e abre conversa para anexar manualmente', async () => {
    const pessoa = await Cadastro.findOne({ nomeCompleto: 'Responsável com Nova Tentativa' });
    await Cadastro.updateOne({ _id: pessoa._id }, { $set: { telefone: '(69) 99999-1111' } });
    await dom.window.carregarOrganizacao();
    await esperar(() => elemento('whatsappCartao') && !elemento('whatsappCartao').disabled, 'atualizar cartão com telefone');
    dom.window.navigator.canShare = () => false;
    elemento('whatsappCartao').click();
    await esperar(() => downloads.length === 1, 'baixar PDF no fallback');
    assert.match(downloads[0], /\.pdf$/);
    assert.match(conversas[0][0], /^https:\/\/wa\.me\/5569999991111\?text=/);
    assert.match(elemento('cartaoStatus').textContent, /Anexe esse arquivo/);
    assert.equal(arquivosCompartilhados.length, 1);
    dom.window.navigator.canShare = () => true;
    await esperar(() => !elemento('whatsappCartao').disabled, 'concluir fallback');
});

test('tela de risco familiar calcula escore ao preencher sentinelas e salva resultado confirmado pelo servidor', async () => {
    const f = await Familia.findOne({ nome: /Responsável com Nova Tentativa/ });
    await dom.window.abrirCoelhoSavassi(f.id);
    assert.equal(elemento('coelhoDialog').open, true);
    elemento('coelhoMoradores').value = '2'; elemento('coelhoComodos').value = '4'; elemento('coelhoSentido').value = 'comodos_por_morador_pdf'; elemento('coelhoSaneamento').value = 'true';
    for (const input of elemento('coelhoSentinelas').querySelectorAll('input')) input.value = '0';
    elemento('sentinela-acamado').value = '1';
    elemento('coelhoForm').dispatchEvent(new dom.window.Event('input'));
    assert.match(elemento('coelhoResultado').textContent, /9 pontos/);
    assert.match(elemento('coelhoResultado').textContent, /não definida/);
    elemento('coelhoProfissional').value = 'Profissional Fictício'; elemento('coelhoFuncao').value = 'Enfermeiro'; elemento('coelhoConfirmacao').checked = true;
    enviar('coelhoForm');
    await esperar(() => !elemento('salvarCoelho').disabled, 'salvar escore familiar');
    assert.match(elemento('coelhoMensagem').textContent, /salva/);
    assert.equal((await Familia.findById(f.id)).avaliacoesRisco.at(-1).coelhoSavassi.score, 9);
    elemento('fecharCoelho').click();
});

test('paciente sem família abre tabela e registra avaliação do seu domicílio', async () => {
    const p = await Cadastro.create({ usuarioId: agente.id, nomeCompleto: 'Paciente Avulso', cpf: '00000000088', dataNascimento: '1990-01-01', endereco: 'Rua Fictícia', numero: '10', bairro: 'Bairro Fictício', telefone: '00000000000', sexo: 'F', criancaDeZeroANove: false, gestante: false });
    await dom.window.abrirCoelhoSavassi(p.id, 'cadastros');
    assert.equal(elemento('coelhoDialog').open, true);
    assert.match(elemento('coelhoFamilia').textContent, /sem família vinculada/);
    for (const [id, valor] of Object.entries({ coelhoMoradores: '1', coelhoComodos: '1', coelhoSentido: 'moradores_por_comodo_titulo', coelhoSaneamento: 'true', coelhoProfissional: 'Profissional de Teste', coelhoFuncao: 'Enfermeiro' })) elemento(id).value = valor;
    for (const input of elemento('coelhoSentinelas').querySelectorAll('input')) input.value = '0';
    elemento('coelhoConfirmacao').checked = true; enviar('coelhoForm');
    await esperar(() => !elemento('salvarCoelho').disabled, 'salvar domicílio avulso');
    assert.equal((await Cadastro.findById(p.id)).avaliacoesRisco.at(-1).coelhoSavassi.score, 5);
    elemento('fecharCoelho').click();
});

test('sair limpa fichas, famílias, contexto de edição e histórico sensível', async () => {
    elemento('logoutBtn').click();
    assert.equal(elemento('appScreen').hidden, true);
    assert.equal(elemento('cadastrosList').children.length, 0);
    assert.equal(elemento('familiasList').children.length, 0);
    assert.equal(elemento('riscoHistorico').children.length, 0);
    assert.equal(elemento('cadastroForm').querySelector('#nomeCompleto').value, '');
    assert.deepEqual(alertas, []);
    assert.deepEqual(erros, []);
});
