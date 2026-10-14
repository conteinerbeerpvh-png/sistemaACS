(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PesquisaACS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function normalizar(valor) { return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    function corresponde(p, termo) {
        let busca = normalizar(termo);
        if (!busca) return true;
        for (const [padrao, campo] of [[/\bnao gestante\b/g, 'gestante'], [/\bnao acamado\b/g, 'acamado'], [/\bnao domiciliado\b/g, 'domiciliado']]) {
            if (padrao.test(busca)) { if (p[campo] !== false) return false; busca = busca.replace(padrao, '').trim(); }
        }
        const tags = [p.gestante === true && 'gestante gestantes gravida gravidas gestacao', p.acamado === true && 'acamado acamada acamados',
            p.domiciliado === true && 'domiciliado domiciliada', p.criancaDeZeroANove === true && 'crianca criancas',
            p.doencasPreexistentes?.includes('Tabagista') && 'tabagista tabagistas fumante fumantes tabagismo',
            p.lgbtqiapn === 'sim' && 'lgbt lgbtq lgbtqia lgbtqiapn lgbtqia+ lgbtqiapn+'];
        const texto = normalizar([p.nomeCompleto, p.cpf, p.telefone, p.bairro, p.endereco, p.numero, p.outrasDoencas,
            ...(p.doencasPreexistentes || []), ...(p.lgbtqiapn === 'sim' ? p.identificacoesLgbtqiapn || [] : []), ...tags.filter(Boolean)].join(' '));
        if (/^[\d.\-()\s]+$/.test(busca)) {
            const digitos = busca.replace(/\D/g, '');
            if (digitos && [p.cpf, p.telefone].some(v => String(v || '').replace(/\D/g, '').includes(digitos))) return true;
        }
        return busca.split(/\s+/).filter(Boolean).every(palavra => texto.includes(palavra));
    }
    return { normalizar, corresponde };
});
