let familias = [];
let pessoasFamilia = [];
let familiaAberta = null;
let familiaEditando = null;
let novoFamiliarContexto = null;
let familiaDoNovoMembro = null;
let riscoContexto = null;
const risco = window.RiscoACS;
let paginaPacientes = 1;
let paginaFamilias = 1;
const porPagina = 5;

function resumoRisco(registros) {
    const atuais = risco.ultimas(registros || []);
    if (!atuais.length) return '<span class="risk-badge">Risco não avaliado</span>';
    return atuais.map(a => `<div><span class="risk-badge risk-${a.nivel}">${texto(risco.tipos[a.tipo])}: ${texto(risco.niveis[a.nivel])}${a.coelhoSavassi ? ` · ${a.coelhoSavassi.score} pontos` : ''}</span><small> Avaliado em ${texto(formatarData(a.dataAvaliacao))}</small>${a.proximaAvaliacao ? `<p class="${risco.pendencia(a) === 'atrasada' ? 'prazo-vencido' : ''}">Reavaliar: ${texto(formatarData(a.proximaAvaliacao))}${risco.pendencia(a) === 'atrasada' ? ' — prazo vencido' : risco.pendencia(a) === 'hoje' ? ' — hoje' : ''}</p>` : '<p>Próxima avaliação não informada.</p>'}</div>`).join('');
}
function familiaDaPessoa(id) { return familias.find(f => f.membros.some(m => String(m.cadastroId?._id || m.cadastroId) === id)); }
function extrasFicha(c) {
    const f = familiaDaPessoa(c._id);
    const vinculo = f ? `<p><strong>Família:</strong> ${texto(f.nome)}${String(f.responsavelId) === c._id ? ' · Responsável' : ''}</p>` : '<p><strong>Família:</strong> não vinculada</p>';
    return vinculo + resumoRisco(avaliacoesDaPessoa(c));
}
function avaliacoesDaPessoa(c) {
    const f = familiaDaPessoa(c._id);
    return [...(c.avaliacoesRisco || []).filter(a => !f || a.tipo !== 'familiar'), ...(f?.avaliacoesRisco || [])];
}
window.extrasFicha = extrasFicha;
window.resumoRisco = resumoRisco;
function filtrosRisco() { return { tipo: $('filtroRiscoTipo').value, nivel: $('filtroRiscoNivel').value, prazo: $('filtroRiscoPrazo').value }; }
window.cadastrosVisiveis = () => cadastros.filter(c => risco.corresponde(avaliacoesDaPessoa(c), filtrosRisco()));
for (const id of ['filtroRiscoTipo', 'filtroRiscoNivel', 'filtroRiscoPrazo']) $(id).addEventListener('change', () => { paginaPacientes = 1; exibirCadastros(); });

async function carregarOrganizacao() {
    if (!token) return false;
    const sessao = token;
    try {
        const respostas = await Promise.all([requisicao('/api/familias'), requisicao('/api/cadastros')]);
        for (const resposta of respostas) if (!resposta.ok) throw new Error(await mensagem(resposta));
        const [novasFamilias, pessoas] = await Promise.all(respostas.map(r => r.json()));
        if (sessao !== token) return false;
        familias = novasFamilias;
        pessoasFamilia = pessoas;
        atualizarResponsaveis();
        exibirFamilias();
        if (familiaAberta) abrirFamilia(familiaAberta);
        exibirCadastros();
        return true;
    } catch (error) { if (sessao === token) $('familiaMensagem').textContent = error.message; return false; }
}
window.carregarOrganizacao = carregarOrganizacao;
function prepararResponsavelNoFormulario(cadastro) {
    const familia = cadastro ? familiaDaPessoa(cadastro._id) : null;
    const jaResponsavel = Boolean(familia && String(familia.responsavelId) === cadastro._id);
    $('responsavelFamilia').checked = jaResponsavel;
    $('responsavelFamilia').disabled = jaResponsavel;
    $('responsavelFamiliaAjuda').textContent = jaResponsavel
        ? 'Este paciente já é responsável pela família. Ao salvar, a área de membros será aberta. Para trocar o responsável, use a área da família.'
        : 'Marque para criar a família com esta ficha. Ao salvar, será aberta a área para adicionar os membros.';
    for (const campo of ['telefone', 'endereco', 'numero', 'bairro']) $(campo).disabled = Boolean(familia && !jaResponsavel);
    if (familia && !jaResponsavel) $('responsavelFamiliaAjuda').textContent = 'Telefone e endereço seguem os dados do responsável. Altere esses dados na ficha dele.';
    atualizarBotaoCadastro();
}
function atualizarBotaoCadastro() {
    $('submitBtn').textContent = $('responsavelFamilia').checked ? 'Salvar e adicionar membros' : 'Salvar cadastro';
}
window.prepararResponsavelNoFormulario = prepararResponsavelNoFormulario;
$('responsavelFamilia').addEventListener('change', atualizarBotaoCadastro);
function focarMembrosFamilia(id) {
    window.mostrarTela('familias');
    abrirFamilia(id);
    $('familiaDetalhe').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    $('membroBusca')?.focus({ preventScroll: true });
}
window.focarMembrosFamilia = focarMembrosFamilia;
window.abrirFamiliaDoResponsavel = async function (cadastro) {
    if (!await carregarOrganizacao()) throw new Error('Não foi possível verificar as famílias existentes');
    let familia = familiaDaPessoa(cadastro._id);
    if (familia && String(familia.responsavelId) !== cadastro._id) {
        if (!confirm(`Esta pessoa já pertence à família “${familia.nome}”. Deseja torná-la responsável? Revise depois o parentesco dos outros membros.`)) {
            focarMembrosFamilia(familia._id);
            return;
        }
        const resposta = await requisicao(`/api/familias/${familia._id}/responsavel`, { method: 'PUT', body: JSON.stringify({ cadastroId: cadastro._id }) });
        if (!resposta.ok) throw new Error(await mensagem(resposta));
    } else if (!familia) {
        const resposta = await requisicao('/api/familias', { method: 'POST', body: JSON.stringify({
            nome: ('Família de ' + cadastro.nomeCompleto).slice(0, 150), responsavelId: cadastro._id,
            numeroFicha: '', microarea: '', endereco: `${cadastro.endereco}, Nº ${cadastro.numero} — ${cadastro.bairro}`.slice(0, 250)
        }) });
        if (!resposta.ok) throw new Error(await mensagem(resposta));
        familia = await resposta.json();
    }
    if (!await carregarOrganizacao()) throw new Error('Não foi possível atualizar a área de membros; a família salva pode ser aberta pela lista');
    $('familiaMensagem').textContent = 'Responsável salvo. Adicione um novo familiar ou pesquise alguém já cadastrado.';
    focarMembrosFamilia(familia._id);
};
window.limparOrganizacao = function () {
    familias = []; pessoasFamilia = []; familiaAberta = null; familiaEditando = null;
    novoFamiliarContexto = null; familiaDoNovoMembro = null; riscoContexto = null;
    window.limparCartoes?.();
    window.limparCoelho?.();
    paginaPacientes = 1; paginaFamilias = 1;
    $('familiasList').replaceChildren(); $('familiaDetalhe').replaceChildren(); $('familiaDetalhe').hidden = true;
    $('familiaForm').reset(); $('riscoForm').reset(); $('riscoHistorico').replaceChildren(); $('riscoAtual').replaceChildren();
    if ($('riscoDialog').open) $('riscoDialog').close();
    $('familiaResponsavel').disabled = false; $('salvarFamilia').textContent = 'Criar família'; $('cancelarFamilia').hidden = true;
    $('familiaCadastroManual').open = false;
    $('familiaMensagem').textContent = ''; $('familiaBusca').value = ''; $('listaEstado').value = 'ativos';
    for (const id of ['filtroRiscoTipo', 'filtroRiscoNivel', 'filtroRiscoPrazo']) $(id).value = '';
};
function atualizarResponsaveis() {
    const anterior = $('familiaResponsavel').value;
    $('familiaResponsavel').innerHTML = '<option value="">Selecione uma pessoa cadastrada...</option>' + pessoasFamilia.filter(p => !familiaDaPessoa(p._id) || String(familiaEditando?.responsavelId) === p._id).map(p => `<option value="${texto(p._id)}">${texto(p.nomeCompleto)} · ${texto(p.cpf)}</option>`).join('');
    $('familiaResponsavel').value = anterior;
}
function exibirFamilias() {
    const termo = $('familiaBusca').value.toLocaleLowerCase('pt-BR');
    const lista = familias.filter(f => [f.nome, f.numeroFicha, f.microarea, ...f.membros.map(m => m.cadastroId?.nomeCompleto)].some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(termo)));
    const total = Math.max(1, Math.ceil(lista.length / porPagina));
    paginaFamilias = Math.min(paginaFamilias, total);
    paginacao('familiasPaginacao', paginaFamilias, total, nova => { paginaFamilias = nova; exibirFamilias(); });
    $('familiasList').innerHTML = lista.length ? lista.slice((paginaFamilias - 1) * porPagina, paginaFamilias * porPagina).map(f => {
        const resp = f.membros.find(m => String(m.cadastroId?._id) === String(f.responsavelId))?.cadastroId;
        return `<article class="familia-item"><h3>${texto(f.nome)}</h3><p>Responsável: ${texto(resp?.nomeCompleto || 'Cadastro indisponível')} · ${f.membros.length} membro(s)</p><p>Ficha: ${texto(f.numeroFicha || 'não informada')} · Microárea: ${texto(f.microarea || 'não informada')}</p>${resumoRisco(f.avaliacoesRisco)}<div class="cadastro-actions"><button type="button" class="btn-edit" data-familia="${texto(f._id)}">Abrir família</button><button type="button" class="btn-secondary" data-cartao-familia="${texto(f._id)}">Cartão</button><button type="button" class="btn-print" data-risco-familia="${texto(f._id)}">Risco familiar</button><button type="button" class="btn-clear" data-editar-familia="${texto(f._id)}">Editar família</button></div></article>`;
    }).join('') : '<p class="help-text">Nenhuma família encontrada. Cadastre primeiro o responsável na ficha individual.</p>';
}
function abrirFamilia(id) {
    const f = familias.find(f => f._id === id);
    if (!f) { familiaAberta = null; $('familiaDetalhe').hidden = true; return; }
    familiaAberta = id;
    const disponiveis = pessoasFamilia.filter(p => !familiaDaPessoa(p._id));
    $('familiaDetalhe').hidden = false;
    $('familiaDetalhe').innerHTML = `<h3>${texto(f.nome)}</h3><p class="help-text">${texto(f.endereco || 'Endereço não informado')}</p>
        <section class="notice"><strong>Cartão da família</strong><p id="cartaoStatus">Preparando cartão frente e verso...</p><div class="cadastro-actions"><button id="verCartao" type="button" class="btn-edit" disabled>Ver cartão</button><button id="baixarCartao" type="button" class="btn-print" disabled>Baixar PDF</button><button id="whatsappCartao" type="button" class="btn-whatsapp" disabled>Enviar por WhatsApp</button><button id="atualizarCartao" type="button" class="btn-clear">Atualizar cartão</button></div><small>Se o celular abrir o menu de compartilhamento, escolha WhatsApp. Quando não houver suporte a anexos, baixe o PDF e anexe na conversa.</small></section>
        <p class="help-text">Telefone, endereço, bairro e número da casa dos membros seguem os dados do responsável.</p>
        <div class="form-group"><label for="membroBusca">Pesquisar pessoa já cadastrada</label><input id="membroBusca" placeholder="Nome, CPF ou telefone" autocomplete="off"></div>
        <div class="form-row"><div class="form-group"><label for="membroExistente">Adicionar cadastro existente</label><select id="membroExistente"><option value="">Selecione...</option>${disponiveis.map(p => `<option value="${texto(p._id)}">${texto(p.nomeCompleto)} · ${texto(p.cpf)}</option>`).join('')}</select></div><div class="form-group"><label for="membroParentesco">Vínculo/parentesco com o responsável</label><input id="membroParentesco" maxlength="100" placeholder="Ex.: filho, cônjuge ou outro vínculo"></div></div>
        <div class="cadastro-actions"><button type="button" id="vincularMembro" class="btn-edit">Vincular cadastro existente</button><button type="button" id="novoMembro" class="btn-secondary">Cadastrar novo familiar</button></div>
        <div>${f.membros.map(m => {
            const p = m.cadastroId;
            if (!p?._id) return '<p class="help-text">Membro indisponível. Verifique o cadastro.</p>';
            const responsavel = String(f.responsavelId) === p._id;
            return `<article class="membro-item"><strong>${texto(p.nomeCompleto)}</strong> · ${responsavel ? 'Responsável' : texto(m.parentesco || 'Vínculo não informado')}${p.arquivado ? ' · Cadastro arquivado' : ''}<p>CPF: ${texto(p.cpf)}</p><div class="cadastro-actions"><button class="btn-print" data-risco-pessoa="${texto(p._id)}" type="button">Risco individual</button>${!responsavel ? `<button class="btn-clear" data-vinculo="${texto(p._id)}" type="button">Editar vínculo</button><button class="btn-edit" data-responsavel="${texto(p._id)}" type="button">Tornar responsável</button><button class="btn-delete" data-desvincular="${texto(p._id)}" type="button">Desvincular</button>` : ''}</div></article>`;
        }).join('')}</div>`;
    window.prepararCartaoFamilia?.(f._id);
    $('membroBusca').addEventListener('input', () => {
        const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const termo = normalizar($('membroBusca').value.trim());
        const digitos = termo.replace(/\D/g, '');
        const buscarDocumento = /^[\d.\-()\s]+$/.test(termo) && digitos;
        const encontrados = disponiveis.filter(p => [p.nomeCompleto, p.cpf, p.telefone].some(valor => normalizar(valor).includes(termo)) ||
            (buscarDocumento && [p.cpf, p.telefone].some(valor => String(valor || '').replace(/\D/g, '').includes(digitos))));
        $('membroExistente').innerHTML = `<option value="">${encontrados.length ? 'Selecione...' : 'Nenhuma pessoa disponível encontrada'}</option>` + encontrados.map(p => `<option value="${texto(p._id)}">${texto(p.nomeCompleto)} · ${texto(p.cpf)}</option>`).join('');
    });
}
$('familiaBusca').addEventListener('input', () => { paginaFamilias = 1; exibirFamilias(); });
$('familiaResponsavel').addEventListener('change', () => {
    if (familiaEditando || $('familiaEndereco').value) return;
    const p = pessoasFamilia.find(p => p._id === $('familiaResponsavel').value);
    if (p) $('familiaEndereco').value = `${p.endereco}, Nº ${p.numero} — ${p.bairro}`;
});
function cancelarFamilia() {
    familiaEditando = null; $('familiaCadastroManual').open = false; $('familiaForm').reset(); $('familiaResponsavel').disabled = false;
    $('salvarFamilia').textContent = 'Criar família'; $('cancelarFamilia').hidden = true; atualizarResponsaveis();
}
$('cancelarFamilia').addEventListener('click', cancelarFamilia);
$('familiaForm').addEventListener('submit', async event => {
    event.preventDefault(); $('salvarFamilia').disabled = true;
    try {
        const dados = { nome: $('familiaNome').value, numeroFicha: $('familiaFicha').value, microarea: $('familiaMicroarea').value, endereco: $('familiaEndereco').value, responsavelId: $('familiaResponsavel').value };
        const resposta = await requisicao(familiaEditando ? `/api/familias/${familiaEditando._id}` : '/api/familias', { method: familiaEditando ? 'PUT' : 'POST', body: JSON.stringify(dados) });
        if (!resposta.ok) throw new Error(await mensagem(resposta));
        const salvo = await resposta.json(); familiaAberta = salvo._id; cancelarFamilia();
        $('familiaMensagem').textContent = 'Família salva com sucesso.'; await carregarOrganizacao();
    } catch (error) { $('familiaMensagem').textContent = error.message; }
    finally { $('salvarFamilia').disabled = false; }
});
$('familiasList').addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.dataset.familia) abrirFamilia(b.dataset.familia);
    if (b.dataset.riscoFamilia) window.abrirCoelhoSavassi?.(b.dataset.riscoFamilia);
    if (b.dataset.cartaoFamilia) { abrirFamilia(b.dataset.cartaoFamilia); window.abrirCartaoFamilia?.(b.dataset.cartaoFamilia); }
    if (b.dataset.editarFamilia) {
        $('familiaCadastroManual').open = true;
        familiaEditando = familias.find(f => f._id === b.dataset.editarFamilia);
        atualizarResponsaveis(); $('familiaNome').value = familiaEditando.nome; $('familiaFicha').value = familiaEditando.numeroFicha || '';
        $('familiaMicroarea').value = familiaEditando.microarea || ''; $('familiaEndereco').value = familiaEditando.endereco || '';
        $('familiaResponsavel').value = String(familiaEditando.responsavelId); $('familiaResponsavel').disabled = true;
        $('salvarFamilia').textContent = 'Salvar alterações da família'; $('cancelarFamilia').hidden = false; $('familiaNome').focus();
    }
});
async function acaoFamilia(rota, metodo, dados) {
    const r = await requisicao(`/api/familias/${familiaAberta}${rota}`, { method: metodo, ...(dados ? { body: JSON.stringify(dados) } : {}) });
    if (!r.ok) throw new Error(await mensagem(r));
    await carregarOrganizacao();
}
$('familiaDetalhe').addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b) return;
    b.disabled = true;
    try {
        if (['verCartao', 'baixarCartao', 'whatsappCartao', 'atualizarCartao'].includes(b.id)) { await window.acaoCartaoFamilia?.(b.id, familiaAberta); return; }
        if (b.id === 'vincularMembro') { if (!$('membroExistente').value) throw new Error('Selecione um cadastro existente.'); await acaoFamilia('/membros', 'POST', { cadastroId: $('membroExistente').value, parentesco: $('membroParentesco').value }); }
        if (b.dataset.responsavel && confirm('Definir esta pessoa como responsável pela família? Revise depois o parentesco dos outros membros em relação ao novo responsável.')) await acaoFamilia('/responsavel', 'PUT', { cadastroId: b.dataset.responsavel });
        if (b.dataset.vinculo) {
            const familia = familias.find(f => f._id === familiaAberta);
            const atual = familia.membros.find(m => m.cadastroId?._id === b.dataset.vinculo)?.parentesco || '';
            const parentesco = prompt('Vínculo/parentesco com o responsável atual:', atual);
            if (parentesco !== null) await acaoFamilia('/membros/' + b.dataset.vinculo, 'PUT', { parentesco });
        }
        if (b.dataset.desvincular && confirm('Desvincular da família? A ficha individual será mantida.')) await acaoFamilia('/membros/' + b.dataset.desvincular, 'DELETE');
        if (b.dataset.riscoPessoa) await window.abrirCoelhoSavassi?.(b.dataset.riscoPessoa, 'cadastros');
        if (b.id === 'novoMembro') {
            cancelarEdicao(); const familia = familias.find(f => f._id === familiaAberta);
            novoFamiliarContexto = { familiaId: familiaAberta, parentesco: $('membroParentesco').value };
            $('responsavelFamilia').disabled = true;
            $('responsavelFamiliaAjuda').textContent = 'Esta pessoa será adicionada como membro da família aberta. O responsável já está definido.';
            const resp = pessoasFamilia.find(p => p._id === String(familia.responsavelId));
            if (resp) { $('telefone').value = resp.telefone || ''; $('endereco').value = resp.endereco; $('numero').value = resp.numero; $('bairro').value = resp.bairro; }
            window.mostrarTela('cadastro');
            $('formTitle').textContent = `Novo familiar — ${familia.nome}`; $('cancelBtn').hidden = false; $('nomeCompleto').focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch (error) { alert(error.message); }
    finally { b.disabled = false; }
});
window.vincularNovoFamiliar = async function (cadastro) {
    const contexto = novoFamiliarContexto; novoFamiliarContexto = null;
    familiaDoNovoMembro = contexto?.familiaId || null;
    if (!contexto) return;
    const r = await requisicao(`/api/familias/${contexto.familiaId}/membros`, { method: 'POST', body: JSON.stringify({ cadastroId: cadastro._id, parentesco: contexto.parentesco }) });
    if (!r.ok) alert(`A ficha foi salva, mas não foi vinculada à família: ${await mensagem(r)}. Use “Vincular cadastro existente” para concluir.`);
};
window.familiaDoNovoMembro = () => familiaDoNovoMembro;
window.cancelarNovoFamiliar = () => { novoFamiliarContexto = null; familiaDoNovoMembro = null; };

function exibirHistorico(avaliacoes) {
    $('riscoAtual').innerHTML = resumoRisco(avaliacoes);
    $('riscoHistorico').innerHTML = avaliacoes.length ? avaliacoes.slice().reverse().map(a => `<article class="registro-risco"><h4>${texto(risco.tipos[a.tipo])} — ${texto(risco.niveis[a.nivel])}</h4><p>Avaliação: ${texto(formatarData(a.dataAvaliacao))} · Registro: ${texto(new Date(a.registradoEm).toLocaleString('pt-BR'))}</p><p>Responsável pela classificação: ${texto(a.profissional)} · ${texto(a.funcaoProfissional)}</p><p>Registrado por: ${texto(a.nomeRegistrador)}</p><p>Protocolo: ${texto(a.protocolo)} · ${texto(a.versaoProtocolo)}</p><p><strong>Justificativa:</strong> ${texto(a.justificativa)}</p>${a.planoAcompanhamento ? `<p><strong>Acompanhamento:</strong> ${texto(a.planoAcompanhamento)}</p>` : ''}<p>Próxima avaliação: ${texto(a.proximaAvaliacao ? formatarData(a.proximaAvaliacao) : 'não informada')}</p></article>`).join('') : '<p class="help-text">Nenhuma avaliação registrada. Isso não significa risco baixo.</p>';
}
async function abrirRisco(rota, id) {
    try {
        const r = await requisicao(`/api/${rota}/${id}/risco`); if (!r.ok) throw new Error(await mensagem(r));
        const dados = await r.json(); riscoContexto = { rota, id };
        $('riscoForm').reset(); $('riscoNome').textContent = dados.nome; $('riscoMensagem').textContent = '';
        $('riscoTipo').innerHTML = '<option value="">Selecione...</option>' + Object.entries(risco.tipos).filter(([chave]) => rota === 'familias' ? chave === 'familiar' : chave !== 'familiar').map(([chave, nome]) => `<option value="${chave}">${texto(nome)}</option>`).join('');
        if (rota === 'familias') $('riscoTipo').value = 'familiar';
        $('riscoData').value = risco.hoje(); $('riscoData').max = risco.hoje(); exibirHistorico(dados.avaliacoes);
        if (!$('riscoDialog').open) $('riscoDialog').showModal();
    } catch (error) { alert(error.message); }
}
window.abrirRisco = abrirRisco;
$('fecharRisco').addEventListener('click', () => $('riscoDialog').close());
$('riscoForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!riscoContexto) return; $('salvarRisco').disabled = true;
    try {
        const dados = { tipo: $('riscoTipo').value, nivel: $('riscoNivel').value, dataAvaliacao: $('riscoData').value, proximaAvaliacao: $('riscoProxima').value, profissional: $('riscoProfissional').value, funcaoProfissional: $('riscoFuncao').value, protocolo: $('riscoProtocolo').value, versaoProtocolo: $('riscoVersao').value, justificativa: $('riscoJustificativa').value, planoAcompanhamento: $('riscoPlano').value, confirmacao: $('riscoConfirmacao').checked };
        const r = await requisicao(`/api/${riscoContexto.rota}/${riscoContexto.id}/risco`, { method: 'POST', body: JSON.stringify(dados) });
        if (!r.ok) throw new Error(await mensagem(r)); const resultado = await r.json();
        exibirHistorico(resultado.avaliacoes); $('riscoMensagem').textContent = 'Avaliação salva com sucesso. O histórico foi preservado.';
        $('riscoConfirmacao').checked = false; await buscarCadastros(); await carregarOrganizacao();
    } catch (error) { $('riscoMensagem').textContent = error.message; }
    finally { $('salvarRisco').disabled = false; }
});
if (token && usuario) carregarOrganizacao();

function mostrarTela(tela) {
    for (const painel of document.querySelectorAll('[data-panel]')) painel.hidden = painel.dataset.panel !== tela;
    for (const botao of document.querySelectorAll('[data-tela]')) {
        if (botao.dataset.tela === tela) botao.setAttribute('aria-current', 'page');
        else botao.removeAttribute('aria-current');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.mostrarTela = mostrarTela;
for (const botao of document.querySelectorAll('[data-tela]')) botao.addEventListener('click', () => {
    if (botao.dataset.tela === 'cadastro') cancelarEdicao();
    mostrarTela(botao.dataset.tela);
});
function paginacao(id, atual, total, mudar) {
    $(id).replaceChildren();
    if (total <= 1) return;
    for (const [titulo, proxima, bloqueado] of [['Anterior', atual - 1, atual === 1], ['Próxima', atual + 1, atual === total]]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-clear'; b.textContent = titulo; b.disabled = bloqueado;
        b.addEventListener('click', () => mudar(proxima)); $(id).append(b);
        if (titulo === 'Anterior') { const textoPagina = document.createElement('span'); textoPagina.textContent = `Página ${atual} de ${total}`; $(id).append(textoPagina); }
    }
}
window.paginarPacientes = lista => {
    const total = Math.max(1, Math.ceil(lista.length / porPagina));
    paginaPacientes = Math.min(paginaPacientes, total);
    paginacao('pacientesPaginacao', paginaPacientes, total, nova => { paginaPacientes = nova; exibirCadastros(); $('listaPacientes').scrollIntoView?.({ behavior: 'smooth' }); });
    return lista.slice((paginaPacientes - 1) * porPagina, paginaPacientes * porPagina);
};
mostrarTela('pacientes');
