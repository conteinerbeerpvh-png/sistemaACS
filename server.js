const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Cadastro = require('./models/cadastro');
const app = express();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';

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

app.post('/api/cadastros', async (req, res) => {
    try {
        const novoCadastro = await Cadastro.create(dadosDoCadastro(req.body));
        res.status(201).json(novoCadastro);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'CPF ja cadastrado.' });
        }
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/cadastros', async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const query = search ? {
            $or: ['nomeCompleto', 'cpf', 'telefone', 'bairro', 'endereco'].map((campo) => ({
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
