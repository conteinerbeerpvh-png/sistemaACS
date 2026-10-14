const risco = require('../public/risco');

function validarAvaliacao(body, usuario, escopo, dataNascimento) {
    const erros = [];
    const dados = {};
    for (const campo of ['tipo', 'nivel', 'dataAvaliacao', 'proximaAvaliacao', 'profissional', 'funcaoProfissional', 'protocolo', 'versaoProtocolo', 'justificativa', 'planoAcompanhamento']) {
        dados[campo] = typeof body[campo] === 'string' ? body[campo].trim() : '';
    }
    const tiposPermitidos = escopo === 'familia' ? ['familiar'] : Object.keys(risco.tipos).filter(tipo => tipo !== 'familiar');
    if (!tiposPermitidos.includes(dados.tipo)) erros.push('Tipo de avaliação inválido para esta ficha.');
    if (!['baixo', 'moderado', 'alto', 'muito_alto'].includes(dados.nivel)) erros.push('Selecione uma classificação válida.');
    if (!risco.dataValida(dados.dataAvaliacao) || dados.dataAvaliacao > risco.hoje()) erros.push('Informe uma data de avaliação válida, até hoje.');
    const nascimento = dataNascimento ? new Date(dataNascimento).toISOString().slice(0, 10) : '';
    if (nascimento && risco.dataValida(dados.dataAvaliacao) && dados.dataAvaliacao < nascimento) erros.push('A avaliação não pode ser anterior ao nascimento.');
    if (dados.proximaAvaliacao && (!risco.dataValida(dados.proximaAvaliacao) || dados.proximaAvaliacao <= dados.dataAvaliacao)) erros.push('A próxima avaliação deve ser posterior à avaliação registrada.');
    for (const [campo, nome, limite] of [
        ['profissional', 'Profissional responsável', 150], ['funcaoProfissional', 'Função do profissional', 100],
        ['protocolo', 'Protocolo utilizado', 250], ['versaoProtocolo', 'Versão/ano do protocolo', 100], ['justificativa', 'Justificativa e critérios', 3000]
    ]) if (!dados[campo] || dados[campo].length > limite) erros.push(`${nome}: preencha até ${limite} caracteres.`);
    if (dados.planoAcompanhamento.length > 3000) erros.push('Plano de acompanhamento: máximo de 3000 caracteres.');
    if (body.confirmacao !== true) erros.push('Confirme o registro da classificação realizada pelo profissional responsável.');
    return { erros, dados: { ...dados, registradoPor: usuario.id, nomeRegistrador: usuario.nome, origem: 'registro_profissional' } };
}

module.exports = { validarAvaliacao };
