const mongoose = require('mongoose');

const cadastroSchema = new mongoose.Schema({
    nomeCompleto: {
        type: String,
        required: true
    },
    dataNascimento: {
        type: Date,
        required: true
    },
    endereco: {
        type: String,
        required: true
    },
    comodidade: {
        type: String,
        required: true
    },
    cpf: {
        type: String,
        required: true,
        unique: true
    },
    telefone: {
        type: String,
        required: true
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Cadastro', cadastroSchema);
