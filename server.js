const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado ao MongoDB'))
    .catch(err => console.error('❌ Erro MongoDB:', err));

// Model do Cadastro
const cadastroSchema = new mongoose.Schema({
    nomeCompleto: {
        type: String,
        required: [true, 'Nome completo é obrigatório']
    },
    dataNascimento: {
        type: Date,
        required: [true, 'Data de nascimento é obrigatória']
    },
    endereco: {
        type: String,
        required: [true, 'Endereço é obrigatório']
    },
    bairro: {
        type: String,
        required: [true, 'Bairro é obrigatório']
    },
    doencasPreexistentes: {
        type: String,
        default: 'Nenhuma'
    },
    cpf: {
        type: String,
        required: [true, 'CPF é obrigatório'],
        unique: true
    },
    telefone: {
        type: String,
        required: [true, 'Telefone é obrigatório']
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    }
});

const Cadastro = mongoose.model('Cadastro', cadastroSchema);

// API Routes
app.post('/api/cadastros', async (req, res) => {
    try {
        const cadastro = new Cadastro(req.body);
        const novoCadastro = await cadastro.save();
        res.status(201).json(novoCadastro);
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ message: 'CPF já cadastrado!' });
        } else {
            res.status(400).json({ message: error.message });
        }
    }
});

app.get('/api/cadastros', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        
        if (search) {
            const term = new RegExp(search, 'i');
            query = {
                $or: [
                    { nomeCompleto: term },
                    { cpf: term },
                    { telefone: term },
                    { bairro: term }
                ]
            };
        }
        
        const cadastros = await Cadastro.find(query).sort({ dataCadastro: -1 });
        res.json(cadastros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findById(req.params.id);
        if (!cadastro) {
            return res.status(404).json({ message: 'Cadastro não encontrado' });
        }
        res.json(cadastro);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!cadastro) {
            return res.status(404).json({ message: 'Cadastro não encontrado' });
        }
        res.json(cadastro);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndDelete(req.params.id);
        if (!cadastro) {
            return res.status(404).json({ message: 'Cadastro não encontrado' });
        }
        res.json({ message: 'Cadastro excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
