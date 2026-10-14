const escala = require('../public/coelho-savassi');
const risco = require('../public/risco');
function prepararAvaliacao(body, usuario) {
    const calculo = escala.calcular(body);
    const erros = [...calculo.erros];
    const dados = {};
    for (const campo of ['dataAvaliacao', 'proximaAvaliacao', 'profissional', 'funcaoProfissional', 'observacoes', 'planoAcompanhamento']) dados[campo] = typeof body[campo] === 'string' ? body[campo].trim() : '';
    if (!risco.dataValida(dados.dataAvaliacao) || dados.dataAvaliacao > risco.hoje()) erros.push('Informe uma data de avaliação válida, até hoje.');
    if (dados.proximaAvaliacao && (!risco.dataValida(dados.proximaAvaliacao) || dados.proximaAvaliacao <= dados.dataAvaliacao)) erros.push('A próxima avaliação deve ser posterior à avaliação registrada.');
    for (const [campo, limite] of [['profissional', 150], ['funcaoProfissional', 100]]) if (!dados[campo] || dados[campo].length > limite) erros.push(`Preencha ${campo} em até ${limite} caracteres.`);
    for (const campo of ['observacoes', 'planoAcompanhamento']) if (dados[campo].length > 3000) erros.push(`O campo ${campo} deve ter até 3000 caracteres.`);
    if (body.confirmacao !== true) erros.push('Confirme os dados coletados e o sentido de divisão escolhido.');
    if (erros.length) return { erros, avaliacao: null };
    const resultado = calculo.resultado;
    return { erros: [], avaliacao: {
        tipo: 'familiar', nivel: resultado.nivel, dataAvaliacao: dados.dataAvaliacao, proximaAvaliacao: dados.proximaAvaliacao,
        profissional: dados.profissional, funcaoProfissional: dados.funcaoProfissional,
        protocolo: 'Escala de Coelho-Savassi - tabela enviada pelo usuário', versaoProtocolo: resultado.versao,
        justificativa: `Escore calculado: ${resultado.score}. ${resultado.classificacao}. Relação: ${resultado.numerador}/${resultado.denominador}. ${dados.observacoes}`.trim(),
        planoAcompanhamento: dados.planoAcompanhamento, registradoPor: usuario.id, nomeRegistrador: usuario.nome,
        origem: 'calculo_coelho_savassi', coelhoSavassi: resultado
    } };
}
module.exports = { prepararAvaliacao };
