const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/acs_cadastro';

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => {
    console.error('❌ Erro ao conectar ao MongoDB:', err.message);
    // Não para o servidor se não conectar
});

// Model
const cadastroSchema = new mongoose.Schema({
    nomeCompleto: { type: String, required: true },
    dataNascimento: { type: Date, required: true },
    endereco: { type: String, required: true },
    comodidade: { type: String, required: true },
    cpf: { type: String, required: true },
    telefone: { type: String, required: true },
    dataCadastro: { type: Date, default: Date.now }
});

const Cadastro = mongoose.model('Cadastro', cadastroSchema);

// Rotas API
app.post('/api/cadastros', async (req, res) => {
    try {
        const cadastro = new Cadastro(req.body);
        await cadastro.save();
        res.status(201).json(cadastro);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/cadastros', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        if (search) {
            query = {
                $or: [
                    { nomeCompleto: { $regex: search, $options: 'i' } },
                    { cpf: { $regex: search, $options: 'i' } },
                    { telefone: { $regex: search, $options: 'i' } }
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
        if (!cadastro) return res.status(404).json({ message: 'Não encontrado' });
        res.json(cadastro);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/cadastros/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!cadastro) return res.status(404).json({ message: 'Não encontrado' });
        res.json(cadastro);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/cadastros/:id', async (req, res) => {
    try {
        await Cadastro.findByIdAndDelete(req.params.id);
        res.json({ message: 'Excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
