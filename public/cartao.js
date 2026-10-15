const cartoesFamilia = new Map();
function marcarCartaoPronto(id, mensagem, pronto) {
    if (familiaAberta !== id || !$('cartaoStatus')) return;
    $('cartaoStatus').textContent = mensagem;
    for (const botao of ['verCartao', 'baixarCartao', 'whatsappCartao']) $(botao).disabled = !pronto;
}
async function prepararCartaoFamilia(id, forcar = false) {
    const familia = familias.find(f => f._id === id);
    if (!familia || !token) return null;
    const assinatura = JSON.stringify([familia.nome, familia.responsavelId, familia.numeroFicha, familia.microarea, familia.membros]);
    const anterior = cartoesFamilia.get(id);
    if (!forcar && anterior?.assinatura === assinatura) {
        if (anterior.arquivo) { marcarCartaoPronto(id, 'Cartão pronto: frente e verso com os dados atuais da família.', true); return anterior; }
        if (anterior.promessa) return anterior.promessa;
    }
    if (anterior?.url) URL.revokeObjectURL(anterior.url);
    const entrada = { assinatura };
    const sessao = token;
    cartoesFamilia.set(id, entrada);
    marcarCartaoPronto(id, 'Preparando cartão frente e verso...', false);
    entrada.promessa = (async () => {
        try {
            const [json, pdf] = await Promise.all([requisicao(`/api/familias/${id}/cartao`), requisicao(`/api/familias/${id}/cartao.pdf`)]);
            if (!json.ok) throw new Error(await mensagem(json));
            if (!pdf.ok) throw new Error(await mensagem(pdf));
            const [dados, arquivo] = await Promise.all([json.json(), pdf.blob()]);
            if (sessao !== token || cartoesFamilia.get(id) !== entrada) return null;
            entrada.dados = dados; entrada.arquivo = arquivo;
            entrada.nome = `cartao-familia-${id.slice(-8)}.pdf`; entrada.url = URL.createObjectURL(arquivo);
            marcarCartaoPronto(id, 'Cartão pronto: frente e verso com os dados atuais da família.', true);
            return entrada;
        } catch (error) {
            if (sessao === token && cartoesFamilia.get(id) === entrada) {
                cartoesFamilia.delete(id);
                marcarCartaoPronto(id, 'Não foi possível preparar o cartão: ' + error.message + '. Use Atualizar cartão para tentar novamente.', false);
            }
            return null;
        }
    })();
    return entrada.promessa;
}
window.prepararCartaoFamilia = prepararCartaoFamilia;
function baixarCartao(entrada) {
    const link = document.createElement('a'); link.href = entrada.url; link.download = entrada.nome;
    document.body.append(link); link.click(); link.remove();
}
function visualizarCartao(dados) {
    const linha = (rotulo, valor) => `<div class="linha-cartao"><strong>${texto(rotulo)}</strong><span>${texto(valor || 'Não informado')}</span></div>`;
    const frente = `<section class="cartao-face"><header class="cartao-header"><img src="assets/brasao-porto-velho.png" alt="Brasão de Porto Velho"><div><strong>${texto(dados.prefeitura)}</strong><p>${texto(dados.secretaria)}</p><strong>${texto(dados.unidade)}</strong></div><img src="assets/saude-familia.png" alt="Saúde da Família"></header>${linha('DATA:', dados.data)}${linha('EQUIPE:', dados.equipe)}${linha('ACS:', dados.acs)}${linha('RESP.:', dados.responsavel)}${linha('END.:', dados.endereco)}${linha('Nº:', dados.numero)}${linha('BAIRRO:', dados.bairro)}<small>Ao procurar a unidade de saúde, leve este cartão e um documento de identificação.</small></section>`;
    const quantidade = Math.max(1, Math.ceil(dados.membros.length / dados.linhasPorVerso));
    let versos = '';
    for (let i = 0; i < quantidade; i++) {
        const membros = dados.membros.slice(i * dados.linhasPorVerso, (i + 1) * dados.linhasPorVerso);
        versos += `<section class="cartao-face"><h3>${texto(dados.nomeFamilia)}</h3><p>Familiares - ${i + 1}/${quantidade}</p><table class="cartao-tabela"><thead><tr><th>CPF</th><th>NOME</th></tr></thead><tbody>${Array.from({ length: 8 }, (_, j) => `<tr><td>${texto(membros[j]?.cpf || '')}</td><td>${texto(membros[j]?.nome || '')}</td></tr>`).join('')}</tbody></table></section>`;
    }
    $('cartaoVisual').innerHTML = frente + versos;
    window.abrirModal('cartaoDialog');
}
window.abrirCartaoFamilia = async id => {
    const entrada = await prepararCartaoFamilia(id);
    if (entrada) visualizarCartao(entrada.dados);
};
window.acaoCartaoFamilia = async (acao, id) => {
    if (acao === 'atualizarCartao') { await prepararCartaoFamilia(id, true); return; }
    const entrada = cartoesFamilia.get(id);
    if (!entrada?.arquivo) { marcarCartaoPronto(id, 'Aguarde o cartão ficar pronto antes de compartilhar.', false); return; }
    if (acao === 'verCartao') { visualizarCartao(entrada.dados); return; }
    if (acao === 'baixarCartao') { baixarCartao(entrada); return; }
    if (acao !== 'whatsappCartao') return;
    const arquivo = new File([entrada.arquivo], entrada.nome, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [arquivo] })) {
        try {
            await navigator.share({ files: [arquivo], title: 'Cartão da família', text: 'Cartão da família - USF Nova Floresta. Equipe MONTE SINAI. ACS DIANA FREIRE.' });
            marcarCartaoPronto(id, 'Cartão entregue ao menu de compartilhamento. Escolha o WhatsApp para enviar.', true);
        } catch (error) {
            if (error.name === 'AbortError') marcarCartaoPronto(id, 'Compartilhamento cancelado. O cartão continua disponível.', true);
            else marcarCartaoPronto(id, 'Não foi possível compartilhar. Use Baixar PDF e anexe no WhatsApp.', true);
        }
        return;
    }
    let numero = String(entrada.dados.telefone || '').replace(/\D/g, '');
    if (numero.length === 10 || numero.length === 11) numero = '55' + numero;
    if (/^55\d{10,11}$/.test(numero)) {
        const mensagemCartao = 'Olá! Segue o cartão da sua família da USF Nova Floresta. Equipe MONTE SINAI - ACS DIANA FREIRE.';
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagemCartao)}`, '_blank', 'noopener,noreferrer');
    }
    baixarCartao(entrada);
    marcarCartaoPronto(id, 'PDF baixado. Anexe esse arquivo à conversa no WhatsApp para concluir o envio.', true);
};
$('fecharCartao').addEventListener('click', () => window.fecharModal('cartaoDialog'));
window.limparCartoes = () => {
    for (const entrada of cartoesFamilia.values()) if (entrada.url) URL.revokeObjectURL(entrada.url);
    cartoesFamilia.clear(); $('cartaoVisual').replaceChildren();
    if ($('cartaoDialog').open) window.fecharModal('cartaoDialog');
};
