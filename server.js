const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Cadastro = require('./models/cadastro');
const Usuario = require('./models/usuario');
const Familia = require('./models/familia');
const pesquisa = require('./public/pesquisa');
const identificacoesPermitidas = ['Lésbica', 'Gay', 'Bissexual', 'Travesti', 'Transexual', 'Transgênero', 'Queer', 'Em questionamento', 'Intersexo', 'Assexual', 'Arromântico(a)', 'Agênero', 'Pansexual', 'Não binário(a)', 'Outra identificação'];
const { organizacao } = require('./routs/organizacao');
const { sincronizarPessoa, aplicarContatoNasFichas } = require('./lib/dadosFamilia');
function criarApp(opcoes = {}) {
    const app = express();
    const JWT_SECRET = opcoes.jwtSecret || process.env.JWT_SECRET;
    if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Configure JWT_SECRET com no mínimo 32 caracteres antes de iniciar.');
    const upload = multer({ storage: multer.memoryStorage() });
    let visionClient;
    try { visionClient = new vision.ImageAnnotatorClient(); } catch (_) { console.warn('Google Vision não configurado.'); }

    app.use(cors());
    app.use(express.json({ limit: '100kb' }));
    app.use(express.static(path.join(__dirname, 'public'), { setHeaders(res, arquivo) {
        if (['sw.js', 'manifest.webmanifest', 'index.html'].includes(path.basename(arquivo))) res.setHeader('Cache-Control', 'no-cache');
    } }));

    function bancoDisponivel(req, res, next) {
        if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Banco de dados indisponível. Verifique MONGODB_URI.' });
        next();
    }
    function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function tokenPara(usuario) {
        return jwt.sign({ id: String(usuario._id), nome: usuario.nome, usuario: usuario.usuario }, JWT_SECRET, { expiresIn: '12h' });
    }
    function respostaDeLogin(res, usuario) {
        return res.status(200).json({
            token: tokenPara(usuario),
            usuario: { nome: usuario.nome, usuario: usuario.usuario }
        });
    }
    function autenticar(req, res, next) {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ message: 'Faça login para continuar.' });
        try { req.usuario = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }); if (typeof req.usuario.id !== 'string' || !/^[a-f\d]{24}$/i.test(req.usuario.id)) throw new Error('Sessão inválida'); next(); }
        catch (_) { return res.status(401).json({ message: 'Sua sessão expirou. Faça login novamente.' }); }
    }

    // CORREÇÃO: Adicionado acamado, domiciliado e outrasDoencas para o banco não ignorar os dados
    function dadosDoCadastro(body) {
        const doencasPermitidas = ['Hipertensão', 'Diabetes', 'Tuberculose', 'Hanseníase', 'Câncer', 'Asma', 'HIV', 'Tabagista'];
        return {
            nomeCompleto: body.nomeCompleto?.trim(), dataNascimento: body.dataNascimento, endereco: body.endereco?.trim(),
            numero: body.numero?.trim(), bairro: body.bairro?.trim(), cpf: body.cpf?.trim(), telefone: body.telefone?.trim(),
            criancaDeZeroANove: body.criancaDeZeroANove === true, sexo: body.sexo, gestante: body.gestante === true,
            acamado: body.acamado === true, domiciliado: body.domiciliado === true, outrasDoencas: body.outrasDoencas?.trim(),
            ...(body.lgbtqiapn !== undefined ? { lgbtqiapn: body.lgbtqiapn, identificacoesLgbtqiapn: body.lgbtqiapn === 'sim' && Array.isArray(body.identificacoesLgbtqiapn) ? [...new Set(body.identificacoesLgbtqiapn.filter(v => identificacoesPermitidas.includes(v)))] : [] } : {}),
            doencasPreexistentes: Array.isArray(body.doencasPreexistentes) ? body.doencasPreexistentes.filter(item => doencasPermitidas.includes(item)) : []
        };
    }
    async function migrarCadastrosDaDiana(usuario) {
        if (usuario.usuario !== '02553357257') return;
        const resultado = await Cadastro.collection.updateMany(
            { $or: [{ usuarioId: { $exists: false } }, { usuarioId: null }] },
            { $set: { usuarioId: usuario._id || usuario.id } }
        );
        if (resultado.modifiedCount) console.log(`${resultado.modifiedCount} cadastro(s) antigo(s) associado(s) à Diana.`);
    }

    app.use('/api', (_, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    app.use('/api', bancoDisponivel);
    app.post('/api/auth/registrar', async (req, res) => {
        try {
            const nome = req.body.nome?.trim(); const usuario = req.body.usuario?.trim().toLowerCase(); const senha = req.body.senha;
            if (!nome || !usuario || !senha || senha.length < 6) return res.status(400).json({ message: 'Informe nome, usuário e senha de no mínimo 6 caracteres.' });
            const novoUsuario = await Usuario.create({ nome, usuario, senhaHash: await bcrypt.hash(senha, 12) });
            migrarCadastrosDaDiana(novoUsuario).catch(error => console.error('Erro ao migrar cadastros antigos:', error.message));
            respostaDeLogin(res, novoUsuario);
        } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Este nome de usuário já existe.' : error.message }); }
    });
    app.post('/api/auth/login', async (req, res) => {
        try {
            const usuario = await Usuario.findOne({ usuario: req.body.usuario?.trim().toLowerCase() });
            if (!usuario || !(await bcrypt.compare(req.body.senha || '', usuario.senhaHash))) return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
            respostaDeLogin(res, usuario);
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ message: 'Não foi possível concluir o login. Tente novamente.' });
        }
    });
    app.post('/api/scan', autenticar, upload.single('ficha'), async (req, res) => {
        try {
            if (!visionClient) return res.status(500).json({ message: 'O servidor não está configurado com as chaves do Google Cloud.' });
            if (!req.file) return res.status(400).json({ message: 'Nenhuma foto enviada.' });
            const [result] = await visionClient.documentTextDetection(req.file.buffer); const fullText = result.fullTextAnnotation?.text || '';
            if (!fullText) return res.status(400).json({ message: 'Não foi possível detectar texto na imagem.' });
            const extrair = regex => fullText.match(regex)?.[1]?.trim() || '';
            res.json({ nomeCompleto: extrair(/Nome(?: Completo)?:\s*(.+)/i), cpf: extrair(/CPF:\s*([\d.-]+)/i), telefone: extrair(/(?:Telefone|Celular):\s*([\d()\s-]+)/i), dataNascimento: extrair(/(?:Data de Nascimento|Nascimento):\s*([\d/]+)/i), endereco: extrair(/(?:Endereço|Rua):\s*(.+)/i), numero: extrair(/(?:N[º°]|Número):\s*(\d+)/i), bairro: extrair(/Bairro:\s*(.+)/i) });
        } catch (error) { console.error('Erro na API Vision:', error); res.status(500).json({ message: 'Erro ao processar a imagem.' }); }
    });
    app.post('/api/cadastros', autenticar, async (req, res) => {
        try { res.status(201).json(await Cadastro.create({ ...dadosDoCadastro(req.body), usuarioId: req.usuario.id })); }
        catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'CPF já cadastrado na sua lista.' : error.message }); }
    });
    app.get('/api/cadastros', autenticar, async (req, res) => {
        try {
            await migrarCadastrosDaDiana(req.usuario);
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            const query = { usuarioId: req.usuario.id, arquivado: req.query.arquivados === '1' ? true : { $ne: true } };
            const fichas = await aplicarContatoNasFichas(await Cadastro.find(query).sort({ dataCadastro: -1 }).lean(), req.usuario.id);
            res.json(fichas.filter(p => pesquisa.corresponde(p, search)));
        }
        catch (error) { res.status(500).json({ message: error.message }); }
    });
    app.get('/api/cadastros/:id', autenticar, async (req, res) => { try { const cadastro = await Cadastro.findOne({ _id: req.params.id, usuarioId: req.usuario.id, arquivado: { $ne: true } }); if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' }); res.json((await aplicarContatoNasFichas([cadastro.toObject()], req.usuario.id))[0]); } catch (_) { res.status(400).json({ message: 'ID inválido.' }); } });
    app.put('/api/cadastros/:id', autenticar, async (req, res) => {
        try {
            const query = { _id: req.params.id, usuarioId: req.usuario.id, arquivado: { $ne: true } };
            const familia = await Familia.findOne({ usuarioId: req.usuario.id, 'membros.cadastroId': req.params.id }).lean();
            const dados = dadosDoCadastro(req.body);
            if (familia?.responsavelId && String(familia.responsavelId) !== req.params.id) {
                const responsavel = await Cadastro.findOne({ _id: familia.responsavelId, usuarioId: req.usuario.id }).lean();
                if (!responsavel) return res.status(409).json({ message: 'Verifique o responsável da família antes de editar os dados.' });
                for (const campo of ['telefone', 'endereco', 'numero', 'bairro']) dados[campo] = responsavel[campo];
            }
            const cadastro = await Cadastro.findOneAndUpdate(query, { $set: dados }, { new: true, runValidators: true });
            if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' });
            await sincronizarPessoa(cadastro._id, req.usuario.id);
            res.json(cadastro);
        } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'CPF já cadastrado na sua lista.' : 'Não foi possível atualizar a ficha e os dados da família. Recarregue e tente novamente.' }); }
    });
    app.delete('/api/cadastros/:id', autenticar, async (req, res) => {
        try {
            const query = { _id: req.params.id, usuarioId: req.usuario.id, arquivado: { $ne: true } };
            const cadastro = await Cadastro.findOne(query).lean();
            if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' });
            if (cadastro.avaliacoesRisco?.length) return res.status(409).json({ message: 'O cadastro possui avaliações de risco. A exclusão foi bloqueada para preservar o histórico.' });
            if (await Familia.exists({ usuarioId: req.usuario.id, 'membros.cadastroId': req.params.id })) return res.status(409).json({ message: 'Desvincule o cadastro da família antes de excluí-lo. Se for responsável, escolha outro primeiro.' });
            const resultado = await Cadastro.updateOne({ ...query, 'avaliacoesRisco.0': { $exists: false } }, { $set: { arquivado: true } });
            if (!resultado.modifiedCount) return res.status(409).json({ message: 'O cadastro foi atualizado. Recarregue a lista antes de tentar novamente.' });
            res.json({ message: 'Cadastro removido da lista com sucesso.' });
        } catch (_) { res.status(400).json({ message: 'ID inválido.' }); }
    });
    app.put('/api/cadastros/:id/restaurar', autenticar, async (req, res) => {
        try {
            const cadastro = await Cadastro.findOneAndUpdate({ _id: req.params.id, usuarioId: req.usuario.id, arquivado: true }, { $set: { arquivado: false } }, { new: true });
            if (!cadastro) return res.status(404).json({ message: 'Cadastro arquivado não encontrado.' });
            res.json(cadastro);
        } catch (_) { res.status(400).json({ message: 'ID inválido.' }); }
    });
    app.use('/api', organizacao(autenticar));
    app.get('/health', (_, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
    app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    return app;
}

if (require.main === module) {
    const app = criarApp();
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';
mongoose.connect(MONGODB_URI).then(async () => {
    try { await Cadastro.collection.dropIndex('cpf_1'); console.log('Índice antigo de CPF removido.'); }
    catch (error) { if (error.codeName !== 'IndexNotFound') console.warn('Não foi possível remover o índice antigo de CPF:', error.message); }
    console.log('MongoDB connected');
}).catch(error => console.error('MongoDB connection error:', error.message));

    app.listen(process.env.PORT || 3000, () => console.log(`Server running on port ${process.env.PORT || 3000}`));
}
module.exports = { criarApp };
