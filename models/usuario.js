const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    usuario: { type: String, required: true, unique: true, trim: true, lowercase: true },
    senhaHash: { type: String, required: true },
    dataCriacao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Usuario', usuarioSchema);
