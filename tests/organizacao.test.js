const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { criarApp } = require('../server');
const Cadastro = require('../models/cadastro');
const Familia = require('../models/familia');
const Usuario = require('../models/usuario');
const risco = require('../public/risco');
const escala = require('../public/coelho-savassi');
let mongo, server, url;
const secret = 'chave-exclusiva-de-testes-ficticios-com-mais-de-32-caracteres';
const agenteA = { id: new mongoose.Types.ObjectId().toString(), nome: 'Agente A', usuario: 'agente-a' };
const agenteB = { id: new mongoose.Types.ObjectId().toString(), nome: 'Agente B', usuario: 'agente-b' };
let sequencia = 0;
const avaliacao = { tipo: 'hipertensao', nivel: 'alto', dataAvaliacao: '2020-01-01', proximaAvaliacao: '2020-02-01',
    profissional: 'Profissional Fictício', funcaoProfissional: 'Enfermeiro', protocolo: 'Protocolo fictício de teste',
    versaoProtocolo: 'TESTE', justificativa: 'Dados fictícios, sem valor clínico.', planoAcompanhamento: 'Plano fictício.', confirmacao: true };

before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([Cadastro.init(), Familia.init(), Usuario.init()]);
    server = criarApp({ jwtSecret: secret }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
});
beforeEach(async () => { await Promise.all([Cadastro.deleteMany({}), Familia.deleteMany({}), Usuario.deleteMany({})]); });

async function api(rota, method = 'GET', body, agente = agenteA) {
    const resposta = await fetch(url + '/api' + rota, { method,
        headers: { ...(agente ? { Authorization: 'Bearer ' + jwt.sign(agente, secret) } : {}), 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: resposta.status, dados: await resposta.json(), cache: resposta.headers.get('cache-control') };
}
async function pessoa(agente = agenteA, extra = {}) {
    const resposta = await api('/cadastros', 'POST', { nomeCompleto: 'Pessoa Fictícia ' + ++sequencia,
        dataNascimento: '1990-01-01', endereco: 'Rua de Teste', numero: '1', bairro: 'Bairro Fictício',
        cpf: String(sequencia).padStart(11, '0'), telefone: '00000000000', sexo: 'F',
        criancaDeZeroANove: false, gestante: false, acamado: true, domiciliado: true,
        doencasPreexistentes: ['Hipertensão'], ...extra }, agente);
    assert.equal(resposta.status, 201);
    return resposta.dados;
}
async function familia(responsavel, agente = agenteA) {
    const r = await api('/familias', 'POST', { nome: 'Família Fictícia', responsavelId: responsavel._id, numeroFicha: 'TESTE', microarea: '01', endereco: 'Rua de Teste' }, agente);
    assert.equal(r.status, 201);
    return r.dados;
}

test('login e registro continuam acessíveis sem autenticação; novos módulos exigem sessão', async () => {
    const registro = await api('/auth/registrar', 'POST', { nome: 'Conta de Teste', usuario: 'teste', senha: 'senha-ficticia' }, null);
    assert.equal(registro.status, 200);
    assert.ok(registro.dados.token);
    assert.equal((await api('/auth/login', 'POST', { usuario: 'teste', senha: 'senha-ficticia' }, null)).status, 200);
    assert.equal((await api('/familias', 'GET', undefined, null)).status, 401);
    assert.equal((await api('/cadastros', 'GET', undefined, null)).status, 401);
});

test('cria família com responsável e vincula cadastro existente sem duplicar pessoa', async () => {
    const responsavel = await pessoa(); const membro = await pessoa(); const f = await familia(responsavel);
    assert.equal(f.membros.length, 1);
    assert.equal(f.responsavelId, responsavel._id);
    const r = await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: membro._id, parentesco: 'Filho' });
    assert.equal(r.status, 201); assert.equal(r.dados.membros.length, 2);
    assert.equal(await Cadastro.countDocuments({}), 2);
    const lista = await api('/familias');
    assert.equal(lista.dados[0].membros[1].cadastroId.nomeCompleto, membro.nomeCompleto);
    assert.equal(lista.cache, 'no-store');
});

test('não permite duplicação nem vincular uma pessoa a duas famílias, inclusive em paralelo', async () => {
    const a = await pessoa(), b = await pessoa(), c = await pessoa();
    const f1 = await familia(a), f2 = await familia(b);
    const resultados = await Promise.all([f1, f2].map(f => api(`/familias/${f._id}/membros`, 'POST', { cadastroId: c._id, parentesco: 'Filho' })));
    assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
    const correta = resultados[0].status === 201 ? f1 : f2;
    assert.equal((await api(`/familias/${correta._id}/membros`, 'POST', { cadastroId: c._id, parentesco: 'Filho' })).status, 409);
    assert.equal((await Familia.find({ 'membros.cadastroId': c._id })).length, 1);
});

test('protege responsável, permite substituição por membro e desvincula sem apagar cadastro', async () => {
    const a = await pessoa(), b = await pessoa(); const f = await familia(a);
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: b._id, parentesco: 'Cônjuge' });
    assert.equal((await api(`/familias/${f._id}/membros/${a._id}`, 'DELETE')).status, 409);
    assert.equal((await api(`/familias/${f._id}/responsavel`, 'PUT', { cadastroId: b._id })).status, 200);
    assert.equal((await api(`/familias/${f._id}/membros/${a._id}`, 'DELETE')).status, 200);
    assert.ok(await Cadastro.findById(a._id));
    assert.equal((await Familia.findById(f._id)).membros.length, 1);
});

test('edita vínculo sem remover membro, incluindo bloqueio de alterações por outro usuário', async () => {
    const a = await pessoa(), b = await pessoa(); const f = await familia(a);
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: b._id, parentesco: 'Filho' });
    assert.equal((await api(`/familias/${f._id}/membros/${b._id}`, 'PUT', { parentesco: 'Outro vínculo' })).status, 200);
    assert.equal((await Familia.findById(f._id)).membros[1].parentesco, 'Outro vínculo');
    assert.equal((await api(`/familias/${f._id}/membros/${b._id}`, 'PUT', { parentesco: 'Adulterado' }, agenteB)).status, 404);
    assert.equal((await Cadastro.countDocuments({})), 2);
});

test('responsável deve pertencer à família e cadastros não podem cruzar usuários', async () => {
    const a = await pessoa(), b = await pessoa(), estrangeiro = await pessoa(agenteB); const f = await familia(a);
    assert.equal((await api(`/familias/${f._id}/responsavel`, 'PUT', { cadastroId: b._id })).status, 404);
    assert.equal((await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: estrangeiro._id, parentesco: 'Filho' })).status, 404);
    assert.equal((await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: b._id, parentesco: 'Filho' }, agenteB)).status, 404);
    assert.equal((await api('/familias', 'GET', undefined, agenteB)).dados.length, 0);
    assert.equal((await api(`/cadastros/${a._id}/risco`, 'POST', avaliacao, agenteB)).status, 404);
    assert.equal((await api(`/familias/${f._id}/risco`, 'POST', { ...avaliacao, tipo: 'familiar' }, agenteB)).status, 404);
});

test('alterar metadados da família preserva membros, responsável e avaliações', async () => {
    const p = await pessoa(); const f = await familia(p);
    await api(`/familias/${f._id}/risco`, 'POST', { ...avaliacao, tipo: 'familiar' });
    const r = await api(`/familias/${f._id}`, 'PUT', { nome: 'Nome Atualizado', numeroFicha: '', microarea: '02', endereco: 'Outro Endereço', responsavelId: new mongoose.Types.ObjectId().toString(), membros: [], avaliacoesRisco: [] });
    assert.equal(r.status, 200); assert.equal(r.dados.responsavelId, p._id);
    assert.equal(r.dados.membros.length, 1); assert.equal(r.dados.avaliacoesRisco.length, 1);
});

test('registra risco individual e familiar separadamente e identifica usuário autenticado', async () => {
    const p = await pessoa(); const f = await familia(p);
    const r = await api(`/cadastros/${p._id}/risco`, 'POST', { ...avaliacao, registradoPor: agenteB.id, nomeRegistrador: 'Nome adulterado' });
    assert.equal(r.status, 201); assert.equal(r.dados.avaliacoes[0].registradoPor, agenteA.id);
    assert.equal(r.dados.avaliacoes[0].nomeRegistrador, agenteA.nome);
    assert.equal((await api(`/familias/${f._id}/risco`, 'POST', { ...avaliacao, tipo: 'familiar' })).status, 201);
    assert.equal((await api(`/familias/${f._id}/risco`, 'POST', avaliacao)).status, 422);
    assert.equal((await api(`/cadastros/${p._id}/risco`, 'POST', { ...avaliacao, tipo: 'familiar' })).status, 422);
    assert.equal((await Cadastro.findById(p._id)).avaliacoesRisco.length, 1);
    assert.equal((await Familia.findById(f._id)).avaliacoesRisco.length, 1);
});

test('registro de avaliação valida datas, protocolo, responsável e confirmação sem alterar histórico', async () => {
    const p = await pessoa();
    for (const invalido of [{ dataAvaliacao: '2020-02-30' }, { dataAvaliacao: '1980-01-01' }, { dataAvaliacao: '2099-01-01' }, { proximaAvaliacao: '2019-01-01' }, { protocolo: '' }, { versaoProtocolo: '' }, { profissional: '' }, { justificativa: '' }, { confirmacao: false }, { nivel: 'constructor' }, { tipo: 'constructor' }]) {
        assert.equal((await api(`/cadastros/${p._id}/risco`, 'POST', { ...avaliacao, ...invalido })).status, 422);
    }
    assert.equal((await Cadastro.findById(p._id)).avaliacoesRisco.length, 0);
});

test('duas avaliações simultâneas são preservadas; editar cadastro não apaga histórico', async () => {
    const p = await pessoa();
    const respostas = await Promise.all([avaliacao, { ...avaliacao, tipo: 'diabetes' }].map(a => api(`/cadastros/${p._id}/risco`, 'POST', a)));
    assert.deepEqual(respostas.map(r => r.status), [201, 201]);
    const original = (await Cadastro.findById(p._id)).avaliacoesRisco.map(a => a.toObject());
    const r = await api(`/cadastros/${p._id}`, 'PUT', { ...p, nomeCompleto: 'Nome alterado', avaliacoesRisco: [] });
    assert.equal(r.status, 200);
    const atualizado = await Cadastro.findById(p._id);
    assert.deepEqual(atualizado.avaliacoesRisco.map(a => a.toObject()), original);
    assert.equal(atualizado.acamado, true); assert.equal(atualizado.domiciliado, true);
});

test('exclusão preserva fichas vinculadas e com histórico; cadastro avulso sai da lista por arquivamento', async () => {
    const p = await pessoa(); await familia(p);
    assert.equal((await api(`/cadastros/${p._id}`, 'DELETE')).status, 409);
    const avaliado = await pessoa(); await api(`/cadastros/${avaliado._id}/risco`, 'POST', avaliacao);
    assert.equal((await api(`/cadastros/${avaliado._id}`, 'DELETE')).status, 409);
    const avulso = await pessoa(); assert.equal((await api(`/cadastros/${avulso._id}`, 'DELETE')).status, 200);
    assert.equal((await Cadastro.findById(avulso._id)).arquivado, true);
    assert.equal((await api(`/cadastros/${avulso._id}`)).status, 404);
    assert.equal((await api('/cadastros')).dados.length, 2);
    assert.equal((await api('/cadastros?arquivados=1')).dados.length, 1);
    assert.equal((await api(`/cadastros/${avulso._id}/restaurar`, 'PUT', {}, agenteB)).status, 404);
    assert.equal((await api(`/cadastros/${avulso._id}/restaurar`, 'PUT')).status, 200);
    assert.equal((await api('/cadastros')).dados.length, 3);
});

test('classificação atual respeita data clínica e filtros não combinam riscos de tipos diferentes', () => {
    const registros = [{ ...avaliacao, dataAvaliacao: '2021-01-01', proximaAvaliacao: '', nivel: 'alto' },
        { ...avaliacao, dataAvaliacao: '2020-01-01', nivel: 'baixo' }, { ...avaliacao, tipo: 'diabetes', nivel: 'baixo' }];
    assert.equal(risco.ultimas(registros).find(a => a.tipo === 'hipertensao').nivel, 'alto');
    assert.equal(risco.corresponde(registros, { nivel: 'alto', prazo: 'atrasada' }), false);
    assert.equal(risco.corresponde(registros, { tipo: 'diabetes', prazo: 'atrasada' }), true);
    assert.equal(risco.corresponde([], { nivel: 'baixo' }), false);
    assert.equal(risco.corresponde([], { nivel: 'nao_avaliado' }), true);
});

test('telefone e endereço do responsável são copiados ao vincular e propagados ao editar, sem cruzar usuários', async () => {
    const resp = await pessoa(agenteA, { telefone: '(69) 99999-1111', endereco: 'Rua da Família', numero: '7', bairro: 'Nova Floresta' });
    const membro = await pessoa(agenteA, { telefone: '12345678901', endereco: 'Outro endereço', numero: '99', bairro: 'Outro bairro' });
    const estrangeiro = await pessoa(agenteB, { numero: '88' });
    const f = await familia(resp);
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: membro._id, parentesco: 'Filho' });
    let atual = await Cadastro.findById(membro._id);
    for (const campo of ['telefone', 'endereco', 'numero', 'bairro']) assert.equal(atual[campo], resp[campo]);
    const atualizado = { ...resp, telefone: '(69) 99999-2222', endereco: 'Rua Nova', numero: '200', bairro: 'Bairro Novo' };
    assert.equal((await api(`/cadastros/${resp._id}`, 'PUT', atualizado)).status, 200);
    atual = await Cadastro.findById(membro._id);
    for (const campo of ['telefone', 'endereco', 'numero', 'bairro']) assert.equal(atual[campo], atualizado[campo]);
    assert.equal((await Cadastro.findById(estrangeiro._id)).numero, '88');
    assert.match((await Familia.findById(f._id)).endereco, /200/);
});

test('membro usa contato familiar canônico; sua edição preserva dados clínicos e históricos', async () => {
    const resp = await pessoa(), membro = await pessoa(); const f = await familia(resp);
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: membro._id, parentesco: 'Filho' });
    await api(`/cadastros/${membro._id}/risco`, 'POST', avaliacao);
    const r = await api(`/cadastros/${membro._id}`, 'PUT', { ...membro, nomeCompleto: 'Nome Individual Editado', telefone: '123', endereco: 'Não deve substituir', numero: '500', bairro: 'Outra região' });
    assert.equal(r.status, 200);
    assert.equal(r.dados.nomeCompleto, 'Nome Individual Editado');
    for (const campo of ['telefone', 'endereco', 'numero', 'bairro']) assert.equal(r.dados[campo], resp[campo]);
    assert.equal(r.dados.avaliacoesRisco.length, 1);
    assert.equal(r.dados.acamado, true);
});

test('cartão automático usa dados atuais, equipe e ACS definidos e acesso privado', async () => {
    const resp = await pessoa(); const f = await familia(resp); const membro = await pessoa();
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: membro._id, parentesco: 'Filho' });
    await api(`/cadastros/${resp._id}`, 'PUT', { ...resp, numero: '300' });
    const cartao = await api(`/familias/${f._id}/cartao`);
    assert.equal(cartao.status, 200); assert.equal(cartao.dados.equipe, 'MONTE SINAI'); assert.equal(cartao.dados.acs, 'DIANA FREIRE');
    assert.equal(cartao.dados.unidade, 'USF NOVA FLORESTA'); assert.equal(cartao.dados.numero, '300');
    assert.equal(cartao.dados.membros.length, 2); assert.equal(cartao.dados.membros[1].cpf, membro.cpf);
    assert.equal(cartao.dados.avaliacoesRisco, undefined);
    assert.equal((await api(`/familias/${f._id}/cartao`, 'GET', undefined, agenteB)).status, 404);
    assert.equal((await api(`/familias/${f._id}/cartao`, 'GET', undefined, null)).status, 401);
    const pdf = await fetch(url + `/api/familias/${f._id}/cartao.pdf`, { headers: { Authorization: 'Bearer ' + jwt.sign(agenteA, secret) } });
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(pdf.headers.get('cache-control'), 'no-store');
    const bytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    assert.equal((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 2);
    assert.equal((await api(`/familias/${f._id}/cartao.pdf`, 'GET', undefined, agenteB)).status, 404);
});

test('cartão acrescenta versos quando a família ultrapassa oito pessoas, sem omitir membros', async () => {
    const resp = await pessoa(); const f = await familia(resp);
    for (let i = 0; i < 8; i++) {
        const m = await pessoa(); await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: m._id, parentesco: 'Familiar' });
    }
    assert.equal((await api(`/familias/${f._id}/cartao`)).dados.membros.length, 9);
    const pdf = await fetch(url + `/api/familias/${f._id}/cartao.pdf`, { headers: { Authorization: 'Bearer ' + jwt.sign(agenteA, secret) } });
    assert.equal(pdf.status, 200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 3);
});

test('avaliação Coelho-Savassi calcula no servidor, mantém histórico anterior e protege acesso', async () => {
    const p = await pessoa(); const f = await familia(p);
    await api(`/familias/${f._id}/risco`, 'POST', { ...avaliacao, tipo: 'familiar' });
    const dados = { moradores: 2, comodos: 4, sentidoRelacao: 'comodos_por_morador_pdf', baixoSaneamento: true,
        quantidades: Object.fromEntries(escala.sentinelas.map(s => [s.id, 0])), dataAvaliacao: '2021-01-01',
        profissional: 'Profissional Fictício', funcaoProfissional: 'Enfermeiro', confirmacao: true, score: 999, nivel: 'r3' };
    dados.quantidades.acamado = 1;
    const r = await api(`/familias/${f._id}/coelho-savassi`, 'POST', dados);
    assert.equal(r.status, 201); assert.equal(r.dados.avaliacao.coelhoSavassi.score, 9);
    assert.equal(r.dados.avaliacao.nivel, 'pendente_pdf'); assert.equal(r.dados.avaliacao.registradoPor, agenteA.id);
    assert.equal((await Familia.findById(f._id)).avaliacoesRisco.length, 2);
    assert.equal((await api(`/familias/${f._id}/coelho-savassi`, 'POST', dados, agenteB)).status, 404);
    assert.equal((await api(`/familias/${f._id}/coelho-savassi`, 'POST', { ...dados, sentidoRelacao: '' })).status, 422);
    assert.equal((await Familia.findById(f._id)).avaliacoesRisco.length, 2);
});

function entradaDomicilio() {
    return { moradores: 1, comodos: 1, sentidoRelacao: 'moradores_por_comodo_titulo', baixoSaneamento: true,
        quantidades: Object.fromEntries(escala.sentinelas.map(s => [s.id, 0])), dataAvaliacao: '2021-01-01',
        profissional: 'Profissional Fictício', funcaoProfissional: 'Enfermeiro', confirmacao: true, score: 999 };
}
test('cadastro sem família registra escore domiciliar calculado sem apagar histórico e protege acesso', async () => {
    const p = await pessoa(); await api(`/cadastros/${p._id}/risco`, 'POST', avaliacao);
    assert.equal((await api(`/cadastros/${p._id}/coelho-savassi`, 'GET', undefined, agenteB)).status, 404);
    assert.equal((await api(`/cadastros/${p._id}/coelho-savassi`, 'POST', entradaDomicilio(), agenteB)).status, 404);
    assert.equal((await api(`/cadastros/${p._id}/coelho-savassi`, 'POST', entradaDomicilio(), null)).status, 401);
    const r = await api(`/cadastros/${p._id}/coelho-savassi`, 'POST', entradaDomicilio());
    assert.equal(r.status, 201); assert.equal(r.dados.familiaId, null);
    assert.equal(r.dados.avaliacao.coelhoSavassi.score, 5); assert.equal(r.dados.avaliacao.tipo, 'familiar');
    assert.equal((await Cadastro.findById(p._id)).avaliacoesRisco.length, 2);
    assert.equal((await api(`/cadastros/${p._id}/coelho-savassi`)).dados.avaliacoes.length, 2);
    assert.equal((await api(`/cadastros/${p._id}/coelho-savassi`, 'POST', { ...entradaDomicilio(), moradores: null })).status, 422);
});
test('avaliação aberta por um membro atualiza somente a família e aparece para todos os membros', async () => {
    const p = await pessoa(), m = await pessoa(); const f = await familia(p);
    await api(`/familias/${f._id}/membros`, 'POST', { cadastroId: m._id, parentesco: 'Filho' });
    const r = await api(`/cadastros/${m._id}/coelho-savassi`, 'POST', entradaDomicilio());
    assert.equal(r.status, 201); assert.equal(r.dados.familiaId, f._id);
    assert.equal((await Cadastro.findById(m._id)).avaliacoesRisco.length, 0);
    assert.equal((await Familia.findById(f._id)).avaliacoesRisco.length, 1);
    const leitura = await api(`/cadastros/${p._id}/coelho-savassi`);
    assert.equal(leitura.dados.avaliacoes[0].coelhoSavassi.score, 5);
    assert.equal(leitura.dados.moradores, 2);
});
