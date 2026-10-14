const test = require('node:test');
const assert = require('node:assert/strict');
const escala = require('../public/coelho-savassi');
const { prepararAvaliacao } = require('../lib/coelhoSavassi');
function base(extra = {}) {
    return { moradores: 20, comodos: 5, sentidoRelacao: 'comodos_por_morador_pdf', baixoSaneamento: false,
        quantidades: Object.fromEntries(escala.sentinelas.map(s => [s.id, 0])), ...extra };
}
test('pesos individuais seguem a tabela e somam por quantidade verificada', () => {
    const pesos = { acamado: 3, deficienciaFisica: 3, deficienciaMental: 3, desnutricaoGrave: 3, drogadicao: 2, desemprego: 2, analfabetismo: 1, menorSeisMeses: 1, maiorSetentaAnos: 1, hipertensao: 1, diabetes: 1 };
    for (const [campo, peso] of Object.entries(pesos)) {
        const dados = base(); dados.quantidades[campo] = 2;
        const r = escala.calcular(dados).resultado;
        assert.equal(r.detalhes.find(d => d.id === campo).pontos, 2 * peso);
        assert.equal(r.score, 1 + 2 * peso);
    }
});
test('saneamento é pontuado uma vez por domicílio; relação <1 usa 1 ponto conforme PDF', () => {
    assert.equal(escala.calcular(base()).resultado.score, 1);
    assert.equal(escala.calcular(base({ baixoSaneamento: true })).resultado.score, 4);
    assert.equal(escala.calcular(base({ moradores: 5, comodos: 5 })).resultado.score, 2);
    assert.equal(escala.calcular(base({ moradores: 5, comodos: 6 })).resultado.score, 3);
});
test('divergência do PDF exige escolha explícita e registra numerador/denominador usados', () => {
    assert.ok(escala.calcular(base({ sentidoRelacao: '' })).erros.length);
    const a = escala.calcular(base({ moradores: 2, comodos: 6 })).resultado;
    const b = escala.calcular(base({ moradores: 2, comodos: 6, sentidoRelacao: 'moradores_por_comodo_titulo' })).resultado;
    assert.equal(a.score, 3); assert.equal(a.numerador, 6); assert.equal(a.denominador, 2);
    assert.equal(b.score, 1); assert.equal(b.numerador, 2); assert.equal(b.denominador, 6);
});
test('fronteiras 4,5,6,7,8,9,10 não inventam a categoria ausente para 9 pontos', () => {
    for (const [total, nivel] of [[4, 'abaixo_r1'], [5, 'r1'], [6, 'r1'], [7, 'r2'], [8, 'r2'], [9, 'pendente_pdf'], [10, 'r3']]) {
        const entrada = base(); entrada.quantidades.hipertensao = total - 1;
        const r = escala.calcular(entrada).resultado; assert.equal(r.score, total); assert.equal(r.nivel, nivel);
    }
});
test('não aceita dados ausentes, contagens fracionadas, negativas ou maiores que moradores', () => {
    for (const alteracao of [{ moradores: 0 }, { comodos: 0 }, { moradores: '2' }, { moradores: 2.5 }, { baixoSaneamento: null }, { quantidades: {} }]) assert.ok(escala.calcular(base(alteracao)).erros.length);
    for (const numero of [-1, 0.5, 21, '2', null]) { const dados = base(); dados.quantidades.acamado = numero; assert.ok(escala.calcular(dados).erros.length); }
});
test('resultado e classificação enviados pelo cliente são ignorados; identidade vem da sessão', () => {
    const dados = { ...base(), dataAvaliacao: '2020-01-01', profissional: 'Profissional Fictício', funcaoProfissional: 'Enfermeiro', confirmacao: true, score: 999, nivel: 'r3', registradoPor: 'intruso' };
    const usuario = { id: '111111111111111111111111', nome: 'Agente Fictício' };
    const a = prepararAvaliacao(dados, usuario).avaliacao;
    assert.equal(a.coelhoSavassi.score, 1); assert.equal(a.nivel, 'abaixo_r1'); assert.equal(a.registradoPor, usuario.id);
    assert.equal(a.origem, 'calculo_coelho_savassi');
    assert.ok(prepararAvaliacao({ ...dados, confirmacao: false }, usuario).erros.length);
});
