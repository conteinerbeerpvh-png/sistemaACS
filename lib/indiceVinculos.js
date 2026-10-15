const chaves = { usuarioId: 1, 'membros.cadastroId': 1 };
const opcoes = { name: 'familia_membros_unicos_v2', unique: true, partialFilterExpression: { 'membros.cadastroId': { $exists: true } } };
async function prepararIndiceFamilias(Familia) {
    // Constrói a proteção nova antes de remover o índice legado. Nenhuma ficha é alterada.
    await Familia.collection.createIndex(chaves, opcoes);
    const indices = await Familia.collection.listIndexes().toArray();
    const antigo = indices.find(i => i.name === 'usuarioId_1_membros.cadastroId_1' && i.unique === true && !i.partialFilterExpression &&
        Object.keys(i.key).length === 2 && i.key.usuarioId === 1 && i.key['membros.cadastroId'] === 1);
    if (antigo) {
        try { await Familia.collection.dropIndex(antigo.name); }
        catch (e) { if (e.code !== 27 && e.codeName !== 'IndexNotFound') throw e; }
    }
}
module.exports = { chaves, opcoes, prepararIndiceFamilias };
