const Cadastro = require('../models/cadastro');
const Familia = require('../models/familia');
const camposCompartilhados = ['telefone', 'endereco', 'numero', 'bairro'];
function contato(pessoa) { return Object.fromEntries(camposCompartilhados.map(campo => [campo, pessoa[campo] || ''])); }
function enderecoCompleto(pessoa) { return `${pessoa.endereco}, Nº ${pessoa.numero} - ${pessoa.bairro}`.slice(0, 250); }

async function sincronizarFamilia(id, usuarioId) {
    const familia = await Familia.findOne({ _id: id, usuarioId }).lean();
    if (!familia || !familia.responsavelId) return null;
    const responsavel = await Cadastro.findOne({ _id: familia.responsavelId, usuarioId }).lean();
    if (!responsavel) throw new Error('Responsável da família não encontrado.');
    const ids = familia.membros.map(m => m.cadastroId).filter(id => String(id) !== String(responsavel._id));
    if (ids.length) await Cadastro.updateMany({ usuarioId, _id: { $in: ids } }, { $set: contato(responsavel) });
    await Familia.updateOne({ _id: familia._id, usuarioId, responsavelId: responsavel._id }, { $set: { endereco: enderecoCompleto(responsavel) } });
    return responsavel;
}
async function sincronizarPessoa(id, usuarioId) {
    const familia = await Familia.findOne({ usuarioId, 'membros.cadastroId': id }).lean();
    if (familia) return sincronizarFamilia(familia._id, usuarioId);
    return null;
}
async function aplicarContatoNasFichas(fichas, usuarioId) {
    const familias = await Familia.find({ usuarioId }).lean();
    const fontes = await Cadastro.find({ usuarioId, _id: { $in: familias.map(f => f.responsavelId) } }).lean();
    const fontePorId = new Map(fontes.map(p => [String(p._id), p]));
    const mapa = new Map();
    for (const familia of familias) {
        const fonte = fontePorId.get(String(familia.responsavelId));
        if (!fonte) continue;
        for (const membro of familia.membros) if (String(membro.cadastroId) !== String(fonte._id)) mapa.set(String(membro.cadastroId), contato(fonte));
    }
    return fichas.map(p => ({ ...p, ...(mapa.get(String(p._id)) || {}) }));
}
module.exports = { contato, enderecoCompleto, sincronizarFamilia, sincronizarPessoa, aplicarContatoNasFichas };
