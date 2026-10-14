const mongoose = require('mongoose');
const risco = require('../public/risco');

module.exports = new mongoose.Schema({
    tipo: { type: String, enum: Object.keys(risco.tipos), required: true },
    nivel: { type: String, enum: Object.keys(risco.niveis), required: true },
    dataAvaliacao: { type: String, required: true },
    proximaAvaliacao: { type: String, default: '' },
    profissional: { type: String, required: true, maxlength: 150 },
    funcaoProfissional: { type: String, required: true, maxlength: 100 },
    protocolo: { type: String, required: true, maxlength: 250 },
    versaoProtocolo: { type: String, required: true, maxlength: 100 },
    justificativa: { type: String, required: true, maxlength: 3000 },
    planoAcompanhamento: { type: String, default: '', maxlength: 3000 },
    registradoEm: { type: Date, default: Date.now, immutable: true },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, immutable: true },
    nomeRegistrador: { type: String, required: true, immutable: true },
    origem: { type: String, enum: ['registro_profissional', 'calculo_coelho_savassi'], default: 'registro_profissional', immutable: true },
    coelhoSavassi: { type: mongoose.Schema.Types.Mixed, default: undefined }
});
