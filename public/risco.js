(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RiscoACS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const tipos = { geral: 'Avaliação geral', hipertensao: 'Hipertensão', diabetes: 'Diabetes', cardiovascular: 'Cardiovascular', gestacao: 'Gestação', familiar: 'Vulnerabilidade familiar' };
    const niveis = { baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto', muito_alto: 'Muito alto' };
    function hoje() {
        const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const valores = Object.fromEntries(partes.map(p => [p.type, p.value]));
        return `${valores.year}-${valores.month}-${valores.day}`;
    }
    function dataValida(valor) {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
        const data = new Date(valor + 'T12:00:00Z');
        return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
    }
    function ultimas(registros = []) {
        const resultado = {};
        for (const registro of registros) {
            if (!Object.hasOwn(tipos, registro.tipo) || !Object.hasOwn(niveis, registro.nivel)) continue;
            if (!resultado[registro.tipo] || registro.dataAvaliacao >= resultado[registro.tipo].dataAvaliacao) resultado[registro.tipo] = registro;
        }
        return Object.values(resultado);
    }
    function pendencia(avaliacao) {
        if (!avaliacao.proximaAvaliacao) return 'sem_data';
        return avaliacao.proximaAvaliacao < hoje() ? 'atrasada' : avaliacao.proximaAvaliacao === hoje() ? 'hoje' : 'agendada';
    }
    function corresponde(registros, filtros) {
        const atuais = ultimas(registros).filter(a => !filtros.tipo || a.tipo === filtros.tipo);
        if (filtros.nivel === 'nao_avaliado') return !atuais.length && !filtros.prazo;
        if (!filtros.nivel && !filtros.prazo) return !filtros.tipo || atuais.length > 0;
        return atuais.some(a => (!filtros.nivel || a.nivel === filtros.nivel) && (!filtros.prazo || pendencia(a) === filtros.prazo));
    }
    return { tipos, niveis, hoje, dataValida, ultimas, pendencia, corresponde };
});
