const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dados em memória
let cadastros = [];
let nextId = 1;

// API Routes
app.post('/api/cadastros', (req, res) => {
    try {
        const cadastro = {
            _id: String(nextId++),
            nomeCompleto: req.body.nomeCompleto,
            dataNascimento: req.body.dataNascimento,
            endereco: req.body.endereco,
            bairro: req.body.bairro,
            doencasPreexistentes: req.body.doencasPreexistentes,
            cpf: req.body.cpf,
            telefone: req.body.telefone,
            dataCadastro: new Date().toISOString()
        };
        cadastros.push(cadastro);
        res.status(201).json(cadastro);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/cadastros', (req, res) => {
    const { search } = req.query;
    let result = cadastros;
    
    if (search) {
        const term = search.toLowerCase();
        result = cadastros.filter(c => 
            c.nomeCompleto.toLowerCase().includes(term) ||
            c.cpf.includes(search) ||
            c.telefone.includes(search) ||
            c.bairro.toLowerCase().includes(term)
        );
    }
    
    res.json(result.reverse());
});

app.get('/api/cadastros/:id', (req, res) => {
    const cadastro = cadastros.find(c => c._id === req.params.id);
    if (cadastro) {
        res.json(cadastro);
    } else {
        res.status(404).json({ message: 'Cadastro não encontrado' });
    }
});

app.put('/api/cadastros/:id', (req, res) => {
    const index = cadastros.findIndex(c => c._id === req.params.id);
    if (index !== -1) {
        cadastros[index] = { ...cadastros[index], ...req.body, _id: req.params.id };
        res.json(cadastros[index]);
    } else {
        res.status(404).json({ message: 'Cadastro não encontrado' });
    }
});

app.delete('/api/cadastros/:id', (req, res) => {
    const index = cadastros.findIndex(c => c._id === req.params.id);
    if (index !== -1) {
        cadastros.splice(index, 1);
        res.json({ message: 'Cadastro excluído com sucesso' });
    } else {
        res.status(404).json({ message: 'Cadastro não encontrado' });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
