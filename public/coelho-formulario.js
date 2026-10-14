let contextoCoelho = null;
const escalaCoelho = window.CoelhoSavassi;
function entradaCoelho() {
    const numero = id => $(id).value === '' ? null : Number($(id).value);
    return { moradores: numero('coelhoMoradores'), comodos: numero('coelhoComodos'), sentidoRelacao: $('coelhoSentido').value,
        baixoSaneamento: $('coelhoSaneamento').value === '' ? null : $('coelhoSaneamento').value === 'true',
        quantidades: Object.fromEntries(escalaCoelho.sentinelas.map(s => [s.id, numero('sentinela-' + s.id)])) };
}
function pontosCoelho(resultado) {
    return `<strong class="risk-badge risk-${resultado.nivel}">${texto(resultado.classificacao)} · ${resultado.score} pontos</strong><p>Relação escolhida: ${resultado.numerador}/${resultado.denominador} = ${resultado.relacao.toFixed(2)}</p><table class="coelho-pontos"><thead><tr><th>Sentinela</th><th>Quantidade × peso</th><th>Pontos</th></tr></thead><tbody>${resultado.detalhes.map(d => `<tr><td>${texto(d.nome)}</td><td>${d.quantidade} × ${d.peso}</td><td>${d.pontos}</td></tr>`).join('')}</tbody></table><p><strong>Total: ${resultado.score} pontos.</strong></p>${resultado.nivel === 'pendente_pdf' ? '<p class="prazo-vencido">A tabela não classifica exatamente 9 pontos. Valide a faixa com a equipe antes de utilizar esse resultado para priorização.</p>' : ''}${resultado.nivel === 'abaixo_r1' ? '<p>A tabela não nomeia uma categoria para valores abaixo de 5. Isso não significa ausência de risco.</p>' : ''}`;
}
function atualizarCalculoCoelho() {
    const calculo = escalaCoelho.calcular(entradaCoelho());
    $('coelhoResultado').innerHTML = calculo.resultado ? pontosCoelho(calculo.resultado) : '<p>Complete moradores, cômodos, saneamento, sentido da divisão e todas as quantidades. Informe 0 somente para ausência verificada.</p>';
}
async function abrirCoelhoSavassi(id, rota = 'familias') {
    try {
        const r = await requisicao(rota === 'cadastros' ? `/api/cadastros/${id}/coelho-savassi` : `/api/familias/${id}/risco`); if (!r.ok) throw new Error(await mensagem(r));
        const dados = await r.json(); if (!token) return;
        contextoCoelho = { id, rota }; $('coelhoForm').reset(); $('coelhoFamilia').textContent = dados.nome; $('coelhoMensagem').textContent = '';
        $('coelhoData').value = risco.hoje(); $('coelhoData').max = risco.hoje();
        const familia = familias.find(f => f._id === id); $('coelhoMoradores').value = (rota === 'cadastros' ? dados.moradores : familia?.membros.length) || '';
        $('coelhoTitulo').textContent = 'Risco do domicílio - Coelho-Savassi';
        $('coelhoSentinelas').innerHTML = escalaCoelho.sentinelas.map(s => `<div class="coelho-criterio"><label for="sentinela-${s.id}"><strong>${texto(s.nome)} · ${s.peso} ponto(s) por pessoa</strong><small>${texto(s.descricao)}</small></label><input id="sentinela-${s.id}" type="number" min="0" max="500" step="1" required aria-label="Quantidade: ${texto(s.nome)}"></div>`).join('');
        $('coelhoHistorico').innerHTML = dados.avaliacoes.length ? dados.avaliacoes.slice().reverse().map(a => `<article class="registro-risco"><h4>${texto(formatarData(a.dataAvaliacao))} - ${texto(a.profissional)}</h4>${a.localRegistro ? `<p>${texto(a.localRegistro)}</p>` : ''}${a.coelhoSavassi ? pontosCoelho(a.coelhoSavassi) : `<p>Avaliação manual anterior: ${texto(risco.niveis[a.nivel] || a.nivel)}. ${texto(a.justificativa)}</p>`}<p>Registrado por: ${texto(a.nomeRegistrador)}</p></article>`).join('') : '<p>Nenhuma avaliação familiar registrada.</p>';
        atualizarCalculoCoelho(); if (!$('coelhoDialog').open) $('coelhoDialog').showModal();
    } catch (error) { alert(error.message); }
}
window.abrirCoelhoSavassi = abrirCoelhoSavassi;
$('coelhoForm').addEventListener('input', atualizarCalculoCoelho);
$('coelhoForm').addEventListener('change', atualizarCalculoCoelho);
$('fecharCoelho').addEventListener('click', () => $('coelhoDialog').close());
$('coelhoForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!contextoCoelho) return; $('salvarCoelho').disabled = true;
    const sessao = token;
    try {
        const dados = { ...entradaCoelho(), dataAvaliacao: $('coelhoData').value, proximaAvaliacao: $('coelhoProxima').value,
            profissional: $('coelhoProfissional').value, funcaoProfissional: $('coelhoFuncao').value, observacoes: $('coelhoObservacoes').value,
            planoAcompanhamento: $('coelhoPlano').value, confirmacao: $('coelhoConfirmacao').checked };
        const r = await requisicao(`/api/${contextoCoelho.rota}/${contextoCoelho.id}/coelho-savassi`, { method: 'POST', body: JSON.stringify(dados) });
        if (!r.ok) throw new Error(await mensagem(r)); const resultado = await r.json(); if (sessao !== token) return;
        const bloco = document.createElement('article'); bloco.className = 'registro-risco'; bloco.innerHTML = `<h4>${texto(formatarData(resultado.avaliacao.dataAvaliacao))}</h4>${pontosCoelho(resultado.avaliacao.coelhoSavassi)}`;
        $('coelhoHistorico').prepend(bloco); $('coelhoResultado').innerHTML = pontosCoelho(resultado.avaliacao.coelhoSavassi);
        $('coelhoMensagem').textContent = 'Escore calculado no servidor e avaliação salva. O histórico foi preservado.';
        $('coelhoConfirmacao').checked = false; await carregarOrganizacao();
    } catch (error) { if (sessao === token) $('coelhoMensagem').textContent = error.message; }
    finally { $('salvarCoelho').disabled = false; }
});
window.limparCoelho = () => { contextoCoelho = null; $('coelhoForm').reset(); $('coelhoHistorico').replaceChildren(); $('coelhoResultado').replaceChildren(); if ($('coelhoDialog').open) $('coelhoDialog').close(); };
