const express = require('express');
const router = express.Router();
const Cadastro = require('../models/Cadastro');

// CREATE - Criar novo cadastro
router.post('/', async (req, res) => {
    try {
        const cadastro = new Cadastro(req.body);
        const novoCadastro = await cadastro.save();
        res.status(201).json(novoCadastro);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// READ - Buscar todos os cadastros
router.get('/', async (req, res) => {
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

// READ - Buscar cadastro por ID
router.get('/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findById(req.params.id);
        if (cadastro) {
            res.json(cadastro);
        } else {
            res.status(404).json({ message: 'Cadastro não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE - Atualizar cadastro
router.put('/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (cadastro) {
            res.json(cadastro);
        } else {
            res.status(404).json({ message: 'Cadastro não encontrado' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE - Excluir cadastro
router.delete('/:id', async (req, res) => {
    try {
        const cadastro = await Cadastro.findByIdAndDelete(req.params.id);
        if (cadastro) {
            res.json({ message: 'Cadastro excluído com sucesso' });
        } else {
            res.status(404).json({ message: 'Cadastro não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
