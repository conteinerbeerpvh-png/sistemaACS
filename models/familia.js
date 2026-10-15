const mongoose = require('mongoose');
const avaliacaoRiscoSchema = require('./avaliacaoRisco');
const { chaves, opcoes } = require('../lib/indiceVinculos');

const familiaSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    arquivado: { type: Boolean, default: false },
    nome: { type: String, trim: true, required: true, maxlength: 150 },
    numeroFicha: { type: String, trim: true, default: '', maxlength: 50 },
    microarea: { type: String, trim: true, default: '', maxlength: 50 },
    endereco: { type: String, trim: true, default: '', maxlength: 250 },
    responsavelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cadastro', default: null },
    membros: [{
        _id: false,
        cadastroId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cadastro', required: true },
        parentesco: { type: String, trim: true, default: '', maxlength: 100 },
        vinculadoEm: { type: Date, default: Date.now }
    }],
    avaliacoesRisco: { type: [avaliacaoRiscoSchema], default: [] }
}, { timestamps: true });

// Um cadastro pertence a uma única família do mesmo agente. A restrição é atômica no MongoDB.
familiaSchema.index(chaves, opcoes);
familiaSchema.pre('validate', function () {
    const ids = this.membros.map(membro => String(membro.cadastroId));
    if (this.responsavelId && !ids.includes(String(this.responsavelId))) this.invalidate('responsavelId', 'O responsável deve ser um membro da família.');
    if (new Set(ids).size !== ids.length) this.invalidate('membros', 'Um membro não pode aparecer duas vezes na família.');
});

module.exports = mongoose.model('Familia', familiaSchema);
