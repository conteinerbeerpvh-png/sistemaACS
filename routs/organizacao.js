const express = require('express');
const mongoose = require('mongoose');
const Familia = require('../models/familia');
const Cadastro = require('../models/cadastro');
const { validarAvaliacao } = require('../lib/avaliacoes');
const { sincronizarFamilia, aplicarContatoNasFichas, enderecoCompleto } = require('../lib/dadosFamilia');
const { dadosCartao, gerarCartaoPDF } = require('../lib/cartaoFamilia');
const { prepararIndiceFamilias } = require('../lib/indiceVinculos');
const { prepararAvaliacao } = require('../lib/coelhoSavassi');

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
    const consultaFamilia = (req, id) => ({ _id: id, usuarioId: req.usuario.id, arquivado: { $ne: true } });

    // Resolve no servidor: um membro sempre consulta e atualiza a família atual.
    async function domicilioCadastro(req) {
        if (!idValido(req.params.id)) return null;
        const cadastro = await Cadastro.findOne({ ...consultaFamilia(req, req.params.id), arquivado: { $ne: true } });
        if (!cadastro) return null;
        const familia = await Familia.findOne({ usuarioId: req.usuario.id, 'membros.cadastroId': cadastro._id });
        return { ficha: familia || cadastro, Modelo: familia ? Familia : Cadastro, familia: Boolean(familia), cadastro };
    }
    router.get('/cadastros/:id/coelho-savassi', async (req, res) => {
        try {
            const contexto = await domicilioCadastro(req);
            if (!contexto) return res.status(404).json({ message: 'Cadastro não encontrado.' });
            const { ficha, familia, cadastro } = contexto;
            res.json({ nome: familia ? `${cadastro.nomeCompleto} — ${ficha.nome}` : `${cadastro.nomeCompleto} — domicílio sem família vinculada`,
                moradores: familia ? ficha.membros.length : null, familiaId: familia ? ficha._id : null,
                avaliacoes: familia ? [...cadastro.avaliacoesRisco.map(a => ({ ...a.toObject(), localRegistro: 'Histórico anterior da ficha' })), ...ficha.avaliacoesRisco.map(a => ({ ...a.toObject(), localRegistro: 'Família atual' }))].sort((a, b) => a.dataAvaliacao.localeCompare(b.dataAvaliacao)) : ficha.avaliacoesRisco || [] });
        } catch (_) { res.status(503).json({ message: 'Não foi possível carregar a avaliação do domicílio.' }); }
    });
    router.post('/cadastros/:id/coelho-savassi', async (req, res) => {
        try {
            const contexto = await domicilioCadastro(req);
            if (!contexto) return res.status(404).json({ message: 'Cadastro não encontrado.' });
            const resultado = prepararAvaliacao(req.body, req.usuario);
            if (resultado.erros.length) return res.status(422).json({ message: resultado.erros.join(' '), erros: resultado.erros });
            const { ficha, Modelo, familia } = contexto;
            const query = { ...consultaFamilia(req, ficha._id), ...(!familia ? { arquivado: { $ne: true } } : {}) };
            const atualizado = await Modelo.findOneAndUpdate(query, { $push: { avaliacoesRisco: resultado.avaliacao } }, { new: true, runValidators: true });
            if (!atualizado) return res.status(404).json({ message: 'Ficha não encontrada.' });
            res.status(201).json({ avaliacao: atualizado.avaliacoesRisco.at(-1), familiaId: familia ? ficha._id : null });
        } catch (_) { res.status(503).json({ message: 'Não foi possível salvar a avaliação do domicílio.' }); }
    });

    router.post('/familias/:id/coelho-savassi', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const query = consultaFamilia(req, req.params.id);
            if (!await Familia.exists(query)) return res.status(404).json({ message: 'Família não encontrada.' });
            const resultado = prepararAvaliacao(req.body, req.usuario);
            if (resultado.erros.length) return res.status(422).json({ message: resultado.erros.join(' '), erros: resultado.erros });
            const familia = await Familia.findOneAndUpdate(query, { $push: { avaliacoesRisco: resultado.avaliacao } }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Família não encontrada.' });
            res.status(201).json({ message: 'Escore calculado e avaliação registrada.', avaliacao: familia.avaliacoesRisco[familia.avaliacoesRisco.length - 1] });
        } catch (_) { res.status(503).json({ message: 'Não foi possível salvar a avaliação. Tente novamente.' }); }
    });

    router.get('/familias/:id/cartao', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const dados = await dadosCartao(req.params.id, req.usuario.id);
            if (!dados) return res.status(404).json({ message: 'Família não encontrada.' });
            res.json(dados);
        } catch (_) { res.status(503).json({ message: 'Não foi possível preparar o cartão.' }); }
    });
    router.get('/familias/:id/cartao.pdf', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const dados = await dadosCartao(req.params.id, req.usuario.id);
            if (!dados) return res.status(404).json({ message: 'Família não encontrada.' });
            const arquivo = await gerarCartaoPDF(dados);
            res.set('Content-Type', 'application/pdf');
            res.set('Content-Disposition', `attachment; filename="cartao-familia-${dados.id.slice(-8)}.pdf"`);
            res.send(arquivo);
        } catch (_) { res.status(503).json({ message: 'Não foi possível gerar o PDF do cartão.' }); }
    });

    router.get('/familias', async (req, res) => {
        try {
            const familias = await Familia.find({ usuarioId: req.usuario.id, arquivado: req.query.arquivadas === '1' ? true : { $ne: true } }).sort({ nome: 1 }).populate({
                path: 'membros.cadastroId', select: 'nomeCompleto cpf telefone dataNascimento endereco numero bairro arquivado', match: { usuarioId: req.usuario.id }
            }).lean();
            const membros = familias.flatMap(f => f.membros.map(m => m.cadastroId).filter(Boolean));
            const corrigidos = await aplicarContatoNasFichas(membros, req.usuario.id);
            const porId = new Map(corrigidos.map(p => [String(p._id), p]));
            for (const f of familias) {
                for (const m of f.membros) if (m.cadastroId) m.cadastroId = porId.get(String(m.cadastroId._id));
                const resp = f.membros.find(m => String(m.cadastroId?._id) === String(f.responsavelId))?.cadastroId;
                if (resp) f.endereco = enderecoCompleto(resp);
            }
            res.json(familias);
        } catch (_) { res.status(503).json({ message: 'Não foi possível carregar as famílias.' }); }
    });
    router.delete('/familias/:id', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const vazia = { ...consultaFamilia(req, req.params.id), 'membros.0': { $exists: false } };
            const excluida = await Familia.findOneAndDelete({ ...vazia, 'avaliacoesRisco.0': { $exists: false } });
            if (excluida) return res.json({ acao: 'excluida', message: 'Família vazia excluída. As fichas individuais foram mantidas.' });
            const arquivada = await Familia.findOneAndUpdate({ ...vazia, 'avaliacoesRisco.0': { $exists: true } }, { $set: { arquivado: true } }, { new: true });
            if (arquivada) return res.json({ acao: 'arquivada', message: 'Família retirada da lista ativa. O histórico está nas famílias arquivadas.' });
            if (await Familia.exists(consultaFamilia(req, req.params.id))) return res.status(409).json({ message: 'Remova os membros antes de excluir a família. As fichas individuais devem ser preservadas.' });
            return res.status(404).json({ message: 'Família não encontrada.' });
        } catch (_) { res.status(503).json({ message: 'Não foi possível excluir a família. Tente novamente.' }); }
    });
    router.get('/familias/:id/historico', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const familia = await Familia.findOne({ _id: req.params.id, usuarioId: req.usuario.id }).lean();
            if (!familia) return res.status(404).json({ message: 'Família não encontrada.' });
            res.json({ nome: familia.nome, arquivado: familia.arquivado === true, avaliacoes: familia.avaliacoesRisco || [] });
        } catch (_) { res.status(503).json({ message: 'Não foi possível consultar o histórico.' }); }
    });
    router.put('/familias/:id/restaurar', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const familia = await Familia.findOneAndUpdate({ _id: req.params.id, usuarioId: req.usuario.id, arquivado: true, 'membros.0': { $exists: false } }, { $set: { arquivado: false } }, { new: true });
            if (!familia) return res.status(404).json({ message: 'Família arquivada não encontrada.' });
            res.json(familia);
        } catch (_) { res.status(503).json({ message: 'Não foi possível restaurar a família.' }); }
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
            await sincronizarFamilia(familia._id, req.usuario.id);
            res.status(201).json(familia);
        } catch (error) { falha(res, error); }
    });
    router.put('/familias/:id', async (req, res) => {
        try {
            if (!idValido(req.params.id)) return res.status(400).json({ message: 'Família inválida.' });
            const familia = await Familia.findOneAndUpdate(consultaFamilia(req, req.params.id), { $set: dadosFamilia(req.body) }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Família não encontrada.' });
            await sincronizarFamilia(familia._id, req.usuario.id);
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
            await sincronizarFamilia(familia._id, req.usuario.id);
            res.status(201).json(familia);
        } catch (error) { falha(res, error); }
    });
    router.delete('/familias/:id/membros/:cadastroId', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.params.cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            const query = { ...consultaFamilia(req, req.params.id), 'membros.cadastroId': req.params.cadastroId };
            if (!await Familia.exists(query)) return res.status(404).json({ message: 'Família ou membro não encontrado.' });
            await prepararIndiceFamilias(Familia);
            const cadastroId = new mongoose.Types.ObjectId(req.params.cadastroId);
            // A função e o vínculo são retirados juntos, mesmo se houver troca simultânea de responsável.
            const familia = await Familia.findOneAndUpdate(query, [{ $set: {
                responsavelId: { $cond: [{ $eq: ['$responsavelId', cadastroId] }, null, '$responsavelId'] },
                membros: { $filter: { input: '$membros', as: 'membro', cond: { $ne: ['$$membro.cadastroId', cadastroId] } } }
            } }], { new: true });
            if (!familia) return res.status(404).json({ message: 'Família ou membro não encontrado.' });
            await sincronizarFamilia(familia._id, req.usuario.id);
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
            await sincronizarFamilia(familia._id, req.usuario.id);
            res.json(familia);
        } catch (error) { falha(res, error); }
    });
    router.delete('/familias/:id/responsavel', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.body.cadastroId)) return res.status(400).json({ message: 'Família ou responsável inválido.' });
            if (!await Familia.exists(consultaFamilia(req, req.params.id))) return res.status(404).json({ message: 'Família não encontrada.' });
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id), responsavelId: req.body.cadastroId },
                { $set: { responsavelId: null } }, { new: true, runValidators: true });
            if (!familia) return res.status(409).json({ message: 'Responsável não encontrado ou já alterado. Recarregue a família.' });
            res.json(familia);
        } catch (error) { falha(res, error); }
    });

    router.put('/familias/:id/responsavel', async (req, res) => {
        try {
            if (!idValido(req.params.id) || !idValido(req.body.cadastroId)) return res.status(400).json({ message: 'Família ou cadastro inválido.' });
            const familia = await Familia.findOneAndUpdate({ ...consultaFamilia(req, req.params.id), 'membros.cadastroId': req.body.cadastroId },
                { $set: { responsavelId: req.body.cadastroId } }, { new: true, runValidators: true });
            if (!familia) return res.status(404).json({ message: 'Escolha um membro desta família como responsável.' });
            await sincronizarFamilia(familia._id, req.usuario.id);
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
