// Apenas apresentação: mantém os mesmos controles, IDs, eventos e dados enviados.
(() => {
    const estados = new Map();
    const porId = id => document.getElementById(id);
    const texto = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const campo = id => porId(id)?.closest('.form-group');
    const valor = id => { const c = porId(id); return c?.tagName === 'SELECT' ? (c.value ? c.selectedOptions[0]?.textContent : id === 'familiaResponsavel' && c.disabled ? 'Responsável pendente' : 'Não informado') : c?.value?.trim() || 'Não informado'; };
    const marcados = nome => [...document.querySelectorAll(`input[name="${nome}"]:checked`)].map(c => c.value).join(', ') || 'Nenhum informado';
    const gruposPaciente = [
        { nome: 'Identificação', nos: () => [document.querySelector('#cadastroForm .ocr-section'), ...['nomeCompleto','dataNascimento','cpf','sexo'].map(campo)], resumo: () => [['Nome',valor('nomeCompleto')],['Nascimento',valor('dataNascimento')],['CPF',valor('cpf')],['Sexo',valor('sexo')]] },
        { nome: 'Contato', nos: () => [campo('telefone')], resumo: () => [['Telefone',valor('telefone')]] },
        { nome: 'Endereço', nos: () => ['endereco','numero','bairro'].map(campo), resumo: () => [['Rua/endereço',valor('endereco')],['Número',valor('numero')],['Bairro',valor('bairro')]] },
        { nome: 'Condições e informações', nos: () => [...['criancaDeZeroANove','gestante','acamado','domiciliado'].map(campo), document.querySelector('#cadastroForm input[name="doenca"]')?.closest('fieldset'), campo('outrasDoencas'), porId('lgbtqiapn')?.closest('fieldset')], resumo: () => [['Criança de 0 a 9 anos',valor('criancaDeZeroANove')],['Gestante',valor('gestante')],['Acamado',valor('acamado')],['Domiciliado',valor('domiciliado')],['Doenças e condições',marcados('doenca')],['Outras doenças',valor('outrasDoencas')],['Identificação LGBTQIAPN+',valor('lgbtqiapn')],...(porId('lgbtqiapn').value === 'sim' ? [['Identificações declaradas',marcados('identificacaoLgbt')]] : [])] },
        { nome: 'Família', nos: () => [porId('responsavelFamilia')?.closest('.notice')], resumo: () => [['Marcar como responsável',porId('responsavelFamilia').checked ? 'Sim' : 'Não'],['Vínculo familiar',porId('responsavelFamiliaAjuda').textContent]] },
        { nome: 'Revisão', nos: () => [] }
    ];
    const gruposFamilia = [
        { nome: 'Dados da família', nos: () => ['familiaNome','familiaFicha','familiaMicroarea'].map(campo), resumo: () => [['Nome da família',valor('familiaNome')],['Ficha familiar',valor('familiaFicha')],['Microárea',valor('familiaMicroarea')]] },
        { nome: 'Responsável e endereço', nos: () => ['familiaResponsavel','familiaEndereco'].map(campo), resumo: () => [['Responsável',valor('familiaResponsavel')],['Endereço',valor('familiaEndereco')]] },
        { nome: 'Revisão', nos: () => [] }
    ];
    function limparErro(c) {
        if (c.dataset.erroEtapas === 'sim') c.setCustomValidity('');
        delete c.dataset.erroEtapas; c.removeAttribute('aria-invalid');
        const id = `etapas-erro-${c.id}`;
        porId(id)?.remove();
        const descricoes = (c.getAttribute('aria-describedby') || '').split(' ').filter(v => v && v !== id);
        if (descricoes.length) c.setAttribute('aria-describedby', descricoes.join(' ')); else c.removeAttribute('aria-describedby');
    }
    function validar(c) {
        if (!c.willValidate) return true;
        limparErro(c);
        let mensagem = '';
        if (c.required && !c.value.trim()) mensagem = c.tagName === 'SELECT' ? 'Selecione uma opção para continuar.' : 'Preencha este campo para continuar.';
        if (c.id === 'dataNascimento' && c.value) {
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(c.value);
            const iso = m && `${m[3]}-${m[2]}-${m[1]}`;
            const data = iso && new Date(`${iso}T00:00:00Z`);
            if (!m || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso) mensagem = 'Informe uma data válida no formato DD/MM/AAAA.';
        }
        if (mensagem) { c.setCustomValidity(mensagem); c.dataset.erroEtapas = 'sim'; }
        if (c.checkValidity()) return true;
        c.setAttribute('aria-invalid', 'true');
        const erro = document.createElement('p'); erro.id = `etapas-erro-${c.id}`; erro.className = 'etapas-erro'; erro.textContent = mensagem || c.validationMessage;
        c.insertAdjacentElement('afterend', erro);
        c.setAttribute('aria-describedby', [c.getAttribute('aria-describedby'), erro.id].filter(Boolean).join(' '));
        return false;
    }
    function validarEtapa(estado, indice) {
        const controles = estado.secoes[indice].querySelectorAll('input,select,textarea');
        let primeiro = null;
        for (const c of controles) if (!validar(c) && !primeiro) primeiro = c;
        if (!primeiro) return true;
        mostrar(estado, indice, false);
        estado.mensagem.textContent = 'Confira o campo indicado antes de continuar.';
        primeiro.focus(); primeiro.reportValidity();
        return false;
    }
    function validarTudo(estado) {
        for (let i = 0; i < estado.grupos.length - 1; i++) if (!validarEtapa(estado, i)) return false;
        return true;
    }
    function montarRevisao(estado) {
        estado.revisao.innerHTML = '<p class="help-text">Confira os dados. O cadastro só será enviado ao tocar no botão de salvar.</p>' + estado.grupos.slice(0,-1).map((grupo, i) => `<section class="etapas-resumo"><div class="etapas-resumo-titulo"><h4>${texto(grupo.nome)}</h4><button type="button" class="btn-clear" data-corrigir-etapa="${i}">Corrigir</button></div><dl>${grupo.resumo().map(([nome,v]) => `<div><dt>${texto(nome)}</dt><dd>${texto(v)}</dd></div>`).join('')}</dl></section>`).join('');
    }
    function mostrar(estado, indice, foco = true) {
        estado.atual = indice; estado.mensagem.textContent = '';
        estado.secoes.forEach((secao, i) => secao.hidden = i !== indice);
        const ultima = indice === estado.grupos.length - 1;
        if (ultima) { estado.revisada = true; montarRevisao(estado); }
        estado.andamento.textContent = `Etapa ${indice+1} de ${estado.grupos.length}`;
        estado.barra.value = indice+1; estado.salto.value = String(indice);
        estado.voltar.hidden = indice === 0;
        estado.proximo.hidden = ultima; estado.salvar.hidden = !ultima;
        estado.rever.hidden = !estado.revisada || ultima;
        if (foco) {
            const dialog = estado.form.closest('dialog'); if (dialog) dialog.scrollTop = 0;
            const titulo = estado.secoes[indice].querySelector('h3'); titulo.focus({ preventScroll: true });
        }
    }
    function avancar(estado) {
        if (estado.atual < estado.grupos.length - 1 && validarEtapa(estado, estado.atual)) mostrar(estado, estado.atual+1);
    }
    function configurar(id, grupos, salvarId) {
        const form = porId(id), salvar = porId(salvarId), rodape = salvar.closest('.form-buttons');
        if (!form || !salvar || !rodape) return;
        const nos = grupos.map(g => g.nos().filter(Boolean));
        const progresso = document.createElement('div'); progresso.className = 'etapas-progresso';
        progresso.innerHTML = `<p class="etapas-andamento" aria-live="polite"></p><progress max="${grupos.length}" value="1" aria-label="Progresso do cadastro"></progress><label class="etapas-salto" hidden>Ir para etapa<select aria-label="Ir para etapa">${grupos.map((g,i) => `<option value="${i}">${texto(g.nome)}</option>`).join('')}</select></label><p class="etapas-mensagem" role="status"></p>`;
        form.prepend(progresso);
        const secoes = grupos.map((grupo, i) => {
            const secao = document.createElement('section'); secao.className = 'etapas-secao'; secao.dataset.etapa = String(i);
            secao.innerHTML = `<h3 tabindex="-1">${texto(grupo.nome)}</h3><div class="etapas-campos"></div>`;
            secao.querySelector('.etapas-campos').append(...nos[i]); form.insertBefore(secao, rodape); return secao;
        });
        for (const linha of form.querySelectorAll('.form-row')) if (!linha.querySelector('input,select,textarea,button')) linha.remove();
        const revisao = secoes.at(-1).querySelector('.etapas-campos'); revisao.className = 'etapas-revisao';
        const voltar = document.createElement('button'); voltar.type = 'button'; voltar.className = 'btn-clear etapas-voltar'; voltar.textContent = 'Voltar'; voltar.dataset.etapasVoltar = '';
        const proximo = document.createElement('button'); proximo.type = 'button'; proximo.className = 'btn-primary etapas-proximo'; proximo.textContent = 'Próximo'; proximo.dataset.etapasProximo = '';
        const rever = document.createElement('button'); rever.type = 'button'; rever.className = 'btn-clear etapas-rever'; rever.textContent = 'Voltar à revisão';
        rodape.classList.add('etapas-acoes'); rodape.prepend(voltar, proximo); rodape.append(rever); salvar.classList.add('etapas-salvar');
        const estado = { form, grupos, secoes, salvar, voltar, proximo, rever, revisao, atual:0, revisada:false, andamento:progresso.querySelector('.etapas-andamento'), barra:progresso.querySelector('progress'), salto:progresso.querySelector('select'), mensagem:progresso.querySelector('.etapas-mensagem') };
        estados.set(id, estado); form.noValidate = true;
        voltar.addEventListener('click', () => mostrar(estado, Math.max(0, estado.atual-1)));
        proximo.addEventListener('click', () => avancar(estado));
        rever.addEventListener('click', () => { if (validarTudo(estado)) mostrar(estado, grupos.length-1); });
        estado.salto.addEventListener('change', () => mostrar(estado, Number(estado.salto.value)));
        revisao.addEventListener('click', event => { const b = event.target.closest('[data-corrigir-etapa]'); if (b) mostrar(estado, Number(b.dataset.corrigirEtapa)); });
        form.addEventListener('input', e => { if (e.target.matches('input,select,textarea')) limparErro(e.target); });
        form.addEventListener('change', e => { if (e.target.matches('input,select,textarea')) limparErro(e.target); });
        form.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing && e.target.matches('input:not([type="checkbox"]):not([type="file"]):not([type="radio"])')) {
                e.preventDefault(); if (estado.atual < grupos.length-1) avancar(estado); else form.requestSubmit(salvar);
            }
        });
        form.addEventListener('submit', e => {
            if (estado.atual !== grupos.length-1) { e.preventDefault(); e.stopImmediatePropagation(); avancar(estado); }
            else if (!validarTudo(estado)) { e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
        form.addEventListener('reset', () => { for (const c of form.querySelectorAll('input,select,textarea')) limparErro(c); estado.revisada=false; estado.salto.closest('label').hidden=true; revisao.replaceChildren(); mostrar(estado,0,false); });
        mostrar(estado,0,false);
    }
    window.reiniciarEtapas = (id, edicao = false) => {
        const estado = estados.get(id); if (!estado) return;
        estado.revisada = false; estado.salto.closest('label').hidden = !edicao;
        for (const c of estado.form.querySelectorAll('input,select,textarea')) limparErro(c);
        mostrar(estado,0,false);
    };
    configurar('cadastroForm',gruposPaciente,'submitBtn');
    configurar('familiaForm',gruposFamilia,'salvarFamilia');
})();
