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
const app = express();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';
const JWT_SECRET = process.env.JWT_SECRET || 'troque-esta-chave-antes-de-publicar';
const upload = multer({ storage: multer.memoryStorage() });
let visionClient;
try { visionClient = new vision.ImageAnnotatorClient(); } catch (_) { console.warn('Google Vision não configurado.'); }

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
mongoose.connect(MONGODB_URI).then(async () => {
    // Remove o índice antigo de CPF único global, permitindo que cada conta tenha a própria lista.
    try { await Cadastro.collection.dropIndex('cpf_1'); console.log('Índice antigo de CPF removido.'); }
    catch (error) { if (error.codeName !== 'IndexNotFound') console.warn('Não foi possível remover o índice antigo de CPF:', error.message); }
    console.log('MongoDB connected');
}).catch(error => console.error('MongoDB connection error:', error.message));

function bancoDisponivel(req, res, next) {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Banco de dados indisponível. Verifique MONGODB_URI.' });
    next();
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tokenPara(usuario) { return jwt.sign({ id: usuario._id, nome: usuario.nome, usuario: usuario.usuario }, JWT_SECRET, { expiresIn: '12h' }); }
function autenticar(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Faça login para continuar.' });
    try { req.usuario = jwt.verify(token, JWT_SECRET); next(); }
    catch (_) { return res.status(401).json({ message: 'Sua sessão expirou. Faça login novamente.' }); }
}
function dadosDoCadastro(body) {
    const doencasPermitidas = ['Hipertensão', 'Diabetes', 'Tuberculose', 'Hanseníase', 'Câncer', 'Asma', 'HIV'];
    return {
        nomeCompleto: body.nomeCompleto?.trim(), dataNascimento: body.dataNascimento, endereco: body.endereco?.trim(),
        numero: body.numero?.trim(), bairro: body.bairro?.trim(), cpf: body.cpf?.trim(), telefone: body.telefone?.trim(),
        criancaDeZeroANove: body.criancaDeZeroANove === true, sexo: body.sexo, gestante: body.gestante === true,
        doencasPreexistentes: Array.isArray(body.doencasPreexistentes) ? body.doencasPreexistentes.filter(item => doencasPermitidas.includes(item)) : []
    };
}
async function migrarCadastrosDaDiana(usuario) {
    if (usuario.usuario !== '0255335732587') return;
    const resultado = await Cadastro.collection.updateMany(
        { $or: [{ usuarioId: { $exists: false } }, { usuarioId: null }] },
        { $set: { usuarioId: usuario._id } }
    );
    if (resultado.modifiedCount) console.log(`${resultado.modifiedCount} cadastro(s) antigo(s) associado(s) à Diana.`);
}

app.use('/api', bancoDisponivel);
app.post('/api/auth/registrar', async (req, res) => {
    try {
        const nome = req.body.nome?.trim(); const usuario = req.body.usuario?.trim().toLowerCase(); const senha = req.body.senha;
        if (!nome || !usuario || !senha || senha.length < 6) return res.status(400).json({ message: 'Informe nome, usuário e senha de no mínimo 6 caracteres.' });
        const novoUsuario = await Usuario.create({ nome, usuario, senhaHash: await bcrypt.hash(senha, 12) });
        await migrarCadastrosDaDiana(novoUsuario);
        res.status(201).json({ token: tokenPara(novoUsuario), usuario: { nome: novoUsuario.nome, usuario: novoUsuario.usuario } });
    } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Este nome de usuário já existe.' : error.message }); }
});
app.post('/api/auth/login', async (req, res) => {
    const usuario = await Usuario.findOne({ usuario: req.body.usuario?.trim().toLowerCase() });
    if (!usuario || !(await bcrypt.compare(req.body.senha || '', usuario.senhaHash))) return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    await migrarCadastrosDaDiana(usuario);
    res.json({ token: tokenPara(usuario), usuario: { nome: usuario.nome, usuario: usuario.usuario } });
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
    try { const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''; const query = { usuarioId: req.usuario.id }; if (search) query.$or = ['nomeCompleto', 'cpf', 'telefone', 'bairro', 'endereco', 'doencasPreexistentes'].map(campo => ({ [campo]: { $regex: escapeRegex(search), $options: 'i' } })); res.json(await Cadastro.find(query).sort({ dataCadastro: -1 })); }
    catch (error) { res.status(500).json({ message: error.message }); }
});
app.get('/api/cadastros/:id', autenticar, async (req, res) => { try { const cadastro = await Cadastro.findOne({ _id: req.params.id, usuarioId: req.usuario.id }); if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' }); res.json(cadastro); } catch (_) { res.status(400).json({ message: 'ID inválido.' }); } });
app.put('/api/cadastros/:id', autenticar, async (req, res) => { try { const cadastro = await Cadastro.findOneAndUpdate({ _id: req.params.id, usuarioId: req.usuario.id }, dadosDoCadastro(req.body), { new: true, runValidators: true }); if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' }); res.json(cadastro); } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'CPF já cadastrado na sua lista.' : error.message }); } });
app.delete('/api/cadastros/:id', autenticar, async (req, res) => { try { const cadastro = await Cadastro.findOneAndDelete({ _id: req.params.id, usuarioId: req.usuario.id }); if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado.' }); res.json({ message: 'Cadastro excluído com sucesso.' }); } catch (_) { res.status(400).json({ message: 'ID inválido.' }); } });
app.get('/health', (_, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log(`Server running on port ${process.env.PORT || 3000}`));
