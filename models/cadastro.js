const mongoose = require('mongoose');
const avaliacaoRiscoSchema = require('./avaliacaoRisco');

const cadastroSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
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
    numero: {
        type: String,
        required: true
    },
    bairro: {
        type: String,
        required: true
    },
    criancaDeZeroANove: { type: Boolean, required: true },
    sexo: { type: String, enum: ['M', 'F'], required: true },
    gestante: { type: Boolean, required: true },
    acamado: { type: Boolean, default: false },
    domiciliado: { type: Boolean, default: false },
    arquivado: { type: Boolean, default: false },
    avaliacoesRisco: { type: [avaliacaoRiscoSchema], default: [] },
    doencasPreexistentes: [{ type: String, enum: ['Hipertensão', 'Diabetes', 'Tuberculose', 'Hanseníase', 'Câncer', 'Asma', 'HIV'] }],
    outrasDoencas: { type: String, trim: true, default: '' },
    cpf: {
        type: String,
        required: true
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

cadastroSchema.index({ usuarioId: 1, cpf: 1 }, { unique: true });

module.exports = mongoose.model('Cadastro', cadastroSchema);
