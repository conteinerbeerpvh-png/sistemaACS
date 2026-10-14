(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CoelhoSavassi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const sentinelas = [
        { id: 'acamado', nome: 'Acamado', peso: 3, descricao: 'Restrito ao domicílio por falta de habilidade/incapacidade de locomoção por si só até a unidade de saúde.' },
        { id: 'deficienciaFisica', nome: 'Deficiência física', peso: 3, descricao: 'Condição física duradoura ou permanente que dificulta atividades cotidianas, escolares, de trabalho ou lazer.' },
        { id: 'deficienciaMental', nome: 'Deficiência mental', peso: 3, descricao: 'Condição mental duradoura ou permanente que dificulta atividades cotidianas, escolares, de trabalho ou lazer.' },
        { id: 'desnutricaoGrave', nome: 'Desnutrição grave', peso: 3, descricao: 'Percentil menor que 0,1 e peso muito baixo para a idade, conforme a avaliação profissional.' },
        { id: 'drogadicao', nome: 'Drogadição', peso: 2, descricao: 'Uso compulsivo de substâncias com potencial de dependência, incluindo álcool, tabaco e medicamentos citados na tabela. Não equivale apenas a qualquer consumo.' },
        { id: 'desemprego', nome: 'Desemprego', peso: 2, descricao: 'Pessoa sem ocupação. Não incluir férias, licenças ou afastamentos temporários. Trabalho doméstico, mesmo sem remuneração, é ocupação.' },
        { id: 'analfabetismo', nome: 'Analfabetismo', peso: 1, descricao: 'A partir da idade escolar, não sabe ler/escrever um bilhete ou apenas assina o nome.' },
        { id: 'menorSeisMeses', nome: 'Menor de 6 meses', peso: 1, descricao: 'Lactente com até 5 meses e 29 dias.' },
        { id: 'maiorSetentaAnos', nome: 'Mais de 70 anos completos', peso: 1, descricao: 'Aplicar a definição de idade da tabela enviada.' },
        { id: 'hipertensao', nome: 'Hipertensão arterial sistêmica', peso: 1, descricao: 'Conferir o critério da tabela: sistólica ≥140 e diastólica ≥90 mmHg em quem não usa anti-hipertensivo. Não é diagnóstico automático a partir do cadastro.' },
        { id: 'diabetes', nome: 'Diabetes mellitus', peso: 1, descricao: 'Condição confirmada conforme avaliação da equipe, de acordo com a definição da tabela.' }
    ];
    function calcular(entrada) {
        const erros = [];
        const moradores = entrada.moradores, comodos = entrada.comodos;
        const inteiro = n => typeof n === 'number' && Number.isSafeInteger(n);
        if (!inteiro(moradores) || moradores < 1 || moradores > 500) erros.push('Informe de 1 a 500 moradores.');
        if (!inteiro(comodos) || comodos < 1 || comodos > 500) erros.push('Informe de 1 a 500 cômodos.');
        if (!['comodos_por_morador_pdf', 'moradores_por_comodo_titulo'].includes(entrada.sentidoRelacao)) erros.push('Escolha explicitamente o sentido da relação, pois o PDF tem uma divergência entre título e descrição.');
        if (typeof entrada.baixoSaneamento !== 'boolean') erros.push('Informe se existem baixas condições de saneamento.');
        const detalhes = [];
        for (const s of sentinelas) {
            const quantidade = entrada.quantidades?.[s.id];
            if (!inteiro(quantidade) || quantidade < 0 || quantidade > moradores) erros.push(`${s.nome}: informe uma quantidade inteira de 0 até o número de moradores.`);
            else detalhes.push({ id: s.id, nome: s.nome, quantidade, peso: s.peso, pontos: quantidade * s.peso });
        }
        if (erros.length) return { erros, resultado: null };
        detalhes.push({ id: 'baixoSaneamento', nome: 'Baixas condições de saneamento', quantidade: entrada.baixoSaneamento ? 1 : 0, peso: 3, pontos: entrada.baixoSaneamento ? 3 : 0 });
        const numerador = entrada.sentidoRelacao === 'comodos_por_morador_pdf' ? comodos : moradores;
        const denominador = entrada.sentidoRelacao === 'comodos_por_morador_pdf' ? moradores : comodos;
        // Comparação inteira evita erros de arredondamento na fronteira da relação igual a 1.
        const pontosRelacao = numerador > denominador ? 3 : numerador === denominador ? 2 : 1;
        detalhes.push({ id: 'relacao', nome: 'Relação de ocupação', quantidade: 1, peso: pontosRelacao, pontos: pontosRelacao });
        const score = detalhes.reduce((soma, d) => soma + d.pontos, 0);
        const nivel = score < 5 ? 'abaixo_r1' : score <= 6 ? 'r1' : score <= 8 ? 'r2' : score === 9 ? 'pendente_pdf' : 'r3';
        const nomes = { abaixo_r1: 'Abaixo da faixa R1 do PDF', r1: 'R1 - Risco menor', r2: 'R2 - Risco médio', r3: 'R3 - Risco máximo', pendente_pdf: 'Escore 9 - classificação não definida no PDF' };
        return { erros: [], resultado: {
            score, nivel, classificacao: nomes[nivel], detalhes, moradores, comodos,
            quantidades: Object.fromEntries(sentinelas.map(s => [s.id, entrada.quantidades[s.id]])),
            baixoSaneamento: entrada.baixoSaneamento, sentidoRelacao: entrada.sentidoRelacao,
            numerador, denominador, relacao: numerador / denominador,
            versao: 'coelho-savassi-pdf-enviado-v1',
            observacoes: [
                'Pesos e relação <1 = 1 ponto seguem o PDF enviado.',
                'O PDF não define uma classe para 9 pontos; esse resultado exige validação da equipe.',
                'Para totais abaixo de 5, o PDF não nomeia uma categoria. Não significa ausência de risco.'
            ]
        } };
    }
    return { sentinelas, calcular };
});
