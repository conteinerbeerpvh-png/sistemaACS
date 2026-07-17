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
    numero: {
        type: String,
        required: [true, 'Número é obrigatório']
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

// CREATE - Criar novo cadastro
app.post('/api/cadastros', async (req, res) => {
    try {
        const cadastro = new Cadastro({
            nomeCompleto: req.body.nomeCompleto,
            dataNascimento: req.body.dataNascimento,
            endereco: req.body.endereco,
            numero: req.body.numero,
            bairro: req.body.bairro,
            doencasPreexistentes: req.body.doencasPreexistentes || 'Nenhuma',
            cpf: req.body.cpf,
            telefone: req.body.telefone
        });
        
        const novoCadastro = await cadastro.save();
        console.log('✅ Cadastro criado:', novoCadastro._id);
        res.status(201).json(novoCadastro);
    } catch (error) {
        console.error('❌ Erro ao criar:', error.message);
        if (error.code === 11000) {
            res.status(400).json({ message: 'CPF já cadastrado!' });
        } else {
            res.status(400).json({ message: error.message });
        }
    }
});

// READ - Buscar todos os cadastros (com busca)
app.get('/api/cadastros', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            query = {
                $or: [
                    { nomeCompleto: { $regex: searchTerm, $options: 'i' } },
                    { cpf: { $regex: searchTerm, $options: 'i' } },
                    { telefone: { $regex: searchTerm, $options: 'i' } },
                    { bairro: { $regex: searchTerm, $options: 'i' } },
                    { endereco: { $regex: searchTerm, $options: 'i' } }
                ]
            };
        }
        
        const cadastros = await Cadastro.find(query).sort({ dataCadastro: -1 });
        console.log(`📋 Busca realizada: ${cadastros.length} resultados`);
        res.json(cadastros);
    } catch (error) {
        console.error('❌ Erro na busca:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// READ - Buscar todos sem filtro (para PDF completo)
app.get('/api/cadastros/todos', async (req, res) => {
    try {
        const cadastros = await Cadastro.find().sort({ dataCadastro: -1 });
        res.json(cadastros);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// READ - Buscar cadastro por ID
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

// UPDATE - Atualizar cadastro
app.put('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndUpdate(
            req.params.id,
            {
                nomeCompleto: req.body.nomeCompleto,
                dataNascimento: req.body.dataNascimento,
                endereco: req.body.endereco,
                numero: req.body.numero,
                bairro: req.body.bairro,
                doencasPreexistentes: req.body.doencasPreexistentes || 'Nenhuma',
                cpf: req.body.cpf,
                telefone: req.body.telefone
            },
            { new: true, runValidators: true }
        );
        
        if (!cadastro) {
            return res.status(404).json({ message: 'Cadastro não encontrado' });
        }
        
        console.log('✅ Cadastro atualizado:', cadastro._id);
        res.json(cadastro);
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error.message);
        res.status(400).json({ message: error.message });
    }
});

// DELETE - Excluir cadastro
app.delete('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndDelete(req.params.id);
        if (!cadastro) {
            return res.status(404).json({ message: 'Cadastro não encontrado' });
        }
        console.log('🗑️ Cadastro excluído:', req.params.id);
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
    console.log(`📝 Acesse: http://localhost:${PORT}`);
});
