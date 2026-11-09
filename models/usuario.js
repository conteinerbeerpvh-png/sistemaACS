const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    usuario: { type: String, required: true, unique: true, trim: true, lowercase: true },
    senhaHash: { type: String, required: true },
    nomeAcs: { type: String, trim: true, maxlength: 120, default: '' },
    unidadeSaude: { type: String, trim: true, maxlength: 120, default: '' },
    equipe: { type: String, trim: true, maxlength: 120, default: '' },
    setor: { type: String, trim: true, maxlength: 120, default: '' },
    dataCriacao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
