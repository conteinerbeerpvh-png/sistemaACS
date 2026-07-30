const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // NOVO: Para receber imagens
const vision = require('@google-cloud/vision'); // NOVO: Inteligência Artificial
require('dotenv').config();

const Cadastro = require('./models/cadastro');
const app = express();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';

// Configuração do Multer (Guarda a foto na memória rapidamente sem salvar no HD)
const upload = multer({ storage: multer.memoryStorage() });

// Tenta iniciar o cliente do Google Vision (precisa da variável de ambiente GOOGLE_APPLICATION_CREDENTIALS)
let visionClient;
try {
    visionClient = new vision.ImageAnnotatorClient();
} catch (error) {
    console.warn("Aviso: Credenciais do Google Cloud Vision não configuradas no ambiente.");
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection error:', error.message));

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dadosDoCadastro(body) {
    return {
        nomeCompleto: body.nomeCompleto?.trim(),
        dataNascimento: body.dataNascimento,
        endereco: body.endereco?.trim(),
        numero: body.numero?.trim(),
        bairro: body.bairro?.trim(),
        doencasPreexistentes: body.doencasPreexistentes?.trim() || 'Nenhuma',
        cpf: body.cpf?.trim(),
        telefone: body.telefone?.trim()
    };
}

function bancoDisponivel(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Banco de dados indisponivel. Verifique MONGODB_URI.' });
    }
    next();
}

app.use('/api', bancoDisponivel);

// =======================
// NOVA ROTA OCR (LEITURA DE FICHA)
// =======================
app.post('/api/scan', upload.single('ficha'), async (req, res) => {
    try {
        if (!visionClient) {
            return res.status(500).json({ message: 'O servidor não está configurado com as chaves do Google Cloud.' });
        }
        
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhuma foto enviada.' });
        }

        // Envia a imagem para o Google ler os textos
        const [result] = await visionClient.documentTextDetection(req.file.buffer);
        const fullText = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';

        if (!fullText) {
            return res.status(400).json({ message: 'Não foi possível detectar texto na imagem.' });
        }

        // Lógica de "caça-palavras" (Regex) para achar os dados na ficha preenchida
        // Você pode ajustar essas palavras chave dependendo de como está escrito na sua ficha de papel
        const extrair = (regex) => {
            const match = fullText.match(regex);
            return match ? match[1].trim() : '';
        };

        const dadosExtraidos = {
            nomeCompleto: extrair(/Nome(?: Completo)?:\s*(.+)/i),
            cpf: extrair(/CPF:\s*([\d\.-]+)/i),
            telefone: extrair(/Telefone:\s*([\d\(\)\s-]+)/i) || extrair(/Celular:\s*([\d\(\)\s-]+)/i),
            dataNascimento: extrair(/Data de Nascimento:\s*([\d\/]+)/i) || extrair(/Nascimento:\s*([\d\/]+)/i),
            endereco: extrair(/Endereço:\s*(.+)/i) || extrair(/Rua:\s*(.+)/i),
            numero: extrair(/N[º°]:\s*(\d+)/i) || extrair(/Número:\s*(\d+)/i),
            bairro: extrair(/Bairro:\s*(.+)/i),
            doencasPreexistentes: extrair(/Doenças.*:\s*(.+)/i)
        };

        res.json(dadosExtraidos);
    } catch (error) {
        console.error('Erro na API Vision:', error);
        res.status(500).json({ message: 'Erro ao processar a imagem. O texto estava ilegível ou ocorreu falha no serviço.' });
    }
});

app.post('/api/cadastros', async (req, res) => {
    try {
        const novoCadastro = await Cadastro.create(dadosDoCadastro(req.body));
        res.status(201).json(novoCadastro);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'CPF ja cadastrado.' });
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/cadastros', async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const query = search ? {
            $or: ['nomeCompleto', 'cpf', 'telefone', 'bairro', 'endereco', 'doencasPreexistentes'].map((campo) => ({
                [campo]: { $regex: escapeRegex(search), $options: 'i' }
            }))
        } : {};
        const cadastros = await Cadastro.find(query).sort({ dataCadastro: -1 });
        res.json(cadastros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/cadastros/todos', async (req, res) => {
    try {
        const cadastros = await Cadastro.find().sort({ dataCadastro: -1 });
        res.json(cadastros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findById(req.params.id);
        if (!cadastro) return res.status(404).json({ message: 'Cadastro nao encontrado.' });
        res.json(cadastro);
    } catch (error) {
        res.status(400).json({ message: 'ID de cadastro invalido.' });
    }
});

app.put('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndUpdate(
            req.params.id,
            dadosDoCadastro(req.body),
            { new: true, runValidators: true }
        );
        if (!cadastro) return res.status(404).json({ message: 'Cadastro nao encontrado.' });
        res.json(cadastro);
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'CPF ja cadastrado.' });
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndDelete(req.params.id);
        if (!cadastro) return res.status(404).json({ message: 'Cadastro nao encontrado.' });
        res.json({ message: 'Cadastro excluido com sucesso.' });
    } catch (error) {
        res.status(400).json({ message: 'ID de cadastro invalido.' });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date()
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));