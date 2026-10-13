const express = require('express');
const mongoose = require('mongoose');
const Familia = require('../models/familia');
const Cadastro = require('../models/cadastro');
const { validarAvaliacao } = require('../lib/avaliacoes');

function organizacao(autenticar) {
    const router = express.Router();
    router.use(autenticar);
    const idValido = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
    const falha = (res, error) => res.status(error.code === 11000 ? 409 : 400).json({
        message: error.code === 11000 ? 'Este cadastro já pertence a uma família. Desvincule-o antes de associar a outra.' : 'Não foi possível salvar. Confira os campos informados.'
    });
    function dadosFamilia(body) {
        const dados = {};
        for (const [campo, limite] of [['nome', 150], ['numeroFicha', 50], ['microarea', 50], ['endereco', 250]]) {
            if (typeof body[campo] !== 'string' || body[campo].trim().length > limite) throw new Error('Campo inválido');
            dados[campo] = body[campo].trim();
        }
        if (!dados.nome) throw new Error('Nome obrigatório');
        return dados;
    }
    const consultaFamilia = (req, id) => ({ _id: id, usuarioId: req.usuario.id });

    router.get('/familias', async (req, res) => {
        try {
            const familias = await Familia.find({ usuarioId: req.usuario.id }).sort({ nome: 1 }).populate({
                path: 'membros.cadastroId', select: 'nomeCompleto cpf dataNascimento endereco numero bairro arquivado', match: { usuarioId: req.usuario.id }
            }).lean();
            res.json(familias);
        } catch (_) { res.status(503).json({ message: 'Não foi possível carregar as famílias.' }); }
    });
    router.post('/familias', async (req, res) => {
        try {
            if (!idValido(req.body.responsavelId)) return res.status(400).json({ message: 'Escolha um responsável já cadastrado.' });
            const responsavel = await Cadastro.findOne({ _id: req.body.responsavelId, usuarioId: req.usuario.id, arquivado: { $ne: true } }).lean();
            if (!responsavel) return res.status(404).json({ message: 'Responsável não encontrado na sua lista.' });
            await Familia.init();
            const familia = await Familia.create({ ...dadosFamilia(req.body), usuarioId: req.usuario.id,
                responsavelId: responsavel._id, membros: [{ cadastroId: responsavel._id, parentesco: '' }]
            });
            res.status(201).json(familia);
        } catch (error) { falha(res, error); }
    });
    router.put('/familias/:id', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const familia = await Familia.findOneAndUpdate(consultaFamilia(req, req.params.id), { $set: dadosFamilia(req.body) }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Família não encontrada.' });
            res.json(familia);
        } catch (error) { falha(res, error); }
    });
    router.post('/familias/:id/membros', async (req, res) => {
        try {
            const { cadastroId } = req.body;
            if (!idValido(req.params.id) || !idValido(cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            if (typeof req.body.parentesco !== 'string' || req.body.parentesco.trim().length > 100) return res.status(400).json({ message: 'Informe o vínculo/parentesco em até 100 caracteres.' });
            const cadastro = await Cadastro.findOne({ _id: cadastroId, usuarioId: req.usuario.id, arquivado: { $ne: true } }).lean();
            if (!cadastro) return res.status(404).json({ message: 'Cadastro não encontrado na sua lista.' });
            await Familia.init();
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id), 'membros.cadastroId': { $ne: cadastroId } }, {
                $push: { membros: { cadastroId, parentesco: req.body.parentesco.trim(), vinculadoEm: new Date() } }
            }, { new: true, runValidators: true });
            if (!familia) {
                const existente = await Familia.findOne(consultaFamilia(req, req.params.id)).lean();
                return res.status(existente ? 409 : 404).json({ message: existente ? 'Este cadastro já está nesta família.' : 'Família não encontrada.' });
            }
            res.status(201).json(familia);
        } catch (error) { falha(res, error); }
    });
    router.delete('/familias/:id/membros/:cadastroId', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.params.cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id),
                responsavelId: { $ne: req.params.cadastroId }, 'membros.cadastroId': req.params.cadastroId
            }, { $pull: { membros: { cadastroId: req.params.cadastroId } } }, { new: true });
            if (!familia) {
                const existente = await Familia.findOne(consultaFamilia(req, req.params.id)).lean();
                if (existente && String(existente.responsavelId) === req.params.cadastroId) return res.status(409).json({ message: 'Escolha outro responsável antes de desvincular o atual.' });
                return res.status(404).json({ message: 'Família ou membro não encontrado.' });
            }
            res.json(familia);
        } catch (error) { falha(res, error); }
    });
    router.put('/familias/:id/membros/:cadastroId', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.params.cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            if (typeof req.body.parentesco !== 'string' || req.body.parentesco.trim().length > 100) return res.status(400).json({ message: 'Informe o vínculo/parentesco em até 100 caracteres.' });
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id), 'membros.cadastroId': req.params.cadastroId },
                { $set: { 'membros.$.parentesco': req.body.parentesco.trim() } }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Família ou membro não encontrado.' });
            res.json(familia);
        } catch (error) { falha(res, error); }
    });
    router.put('/familias/:id/responsavel', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.body.cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id), 'membros.cadastroId': req.body.cadastroId },
                { $set: { responsavelId: req.body.cadastroId } }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Escolha um membro desta família como responsável.' });
            res.json(familia);
        } catch (error) { falha(res, error); }
    });

    for (const [rota, Modelo, escopo] of [['cadastros', Cadastro, 'individual'], ['familias', Familia, 'familia']]) {
        router.get(`/${rota}/:id/risco`, async (req, res) => {
            try {
                if (!idValido(req.params.id)) return res.status(400).json({ message: 'Ficha inválida.' });
                const ficha = await Modelo.findOne({ ...consultaFamilia(req, req.params.id), ...(escopo === 'individual' ? { arquivado: { $ne: true } } : {}) }).lean();
                if (!ficha) return res.status(404).json({ message: 'Ficha não encontrada.' });
                res.json({ id: ficha._id, nome: ficha.nomeCompleto || ficha.nome, escopo, avaliacoes: ficha.avaliacoesRisco || [] });
            } catch (_) { res.status(503).json({ message: 'Não foi possível carregar as avaliações.' }); }
        });
        router.post(`/${rota}/:id/risco`, async (req, res) => {
            try {
                if (!idValido(req.params.id)) return res.status(400).json({ message: 'Ficha inválida.' });
                const query = { ...consultaFamilia(req, req.params.id), ...(escopo === 'individual' ? { arquivado: { $ne: true } } : {}) };
                const ficha = await Modelo.findOne(query).lean();
                if (!ficha) return res.status(404).json({ message: 'Ficha não encontrada.' });
                const resultado = validarAvaliacao(req.body, req.usuario, escopo, ficha.dataNascimento);
                if (resultado.erros.length) return res.status(422).json({ message: resultado.erros.join(' '), erros: resultado.erros });
                // Push atômico evita que duas avaliações simultâneas apaguem uma à outra.
                const atualizado = await Modelo.findOneAndUpdate(query, { $push: { avaliacoesRisco: resultado.dados } }, { new: true, runValidators: true });
                if (!atualizado) return res.status(404).json({ message: 'Ficha não encontrada.' });
                res.status(201).json({ message: 'Avaliação registrada com sucesso.', avaliacoes: atualizado.avaliacoesRisco });
            } catch (error) { falha(res, error); }
        });
    }
    return router;
}

module.exports = { organizacao };
