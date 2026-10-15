(() => {
    const instalar = document.getElementById('instalarApp');
    const atualizar = document.getElementById('atualizarApp');
    const status = document.getElementById('pwaStatus');
    let convite = null, registro = null, recarregar = false;
    const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    function conexao() {
        instalar.hidden = instalado();
        status.classList.toggle('pwa-offline', !navigator.onLine);
        status.textContent = navigator.onLine ? '' : 'Sem conexão — consultas e salvamentos precisam de internet.';
    }
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); convite = event; instalar.hidden = instalado(); });
    window.addEventListener('appinstalled', () => { convite = null; instalar.hidden = true; status.textContent = 'Aplicativo instalado.'; });
    instalar.addEventListener('click', async () => {
        if (!convite) { window.abrirModal('instalacaoDialog'); return; }
        const atual = convite; convite = null;
        try { await atual.prompt(); await atual.userChoice; }
        catch (_) { window.abrirModal('instalacaoDialog'); }
    });
    document.getElementById('fecharInstalacao').addEventListener('click', () => window.fecharModal('instalacaoDialog'));
    function avisarAtualizacao() { atualizar.hidden = false; status.textContent = 'Nova versão disponível. Salve e feche os formulários antes de atualizar.'; }
    atualizar.addEventListener('click', () => {
        if (document.querySelector('dialog[open]')) { status.textContent = 'Salve ou feche as janelas abertas antes de atualizar.'; return; }
        if (registro?.waiting) { recarregar = true; registro.waiting.postMessage({ type: 'ATIVAR_ATUALIZACAO' }); }
        else location.reload();
    });
    conexao(); window.addEventListener('online', conexao); window.addEventListener('offline', conexao);
    if ('serviceWorker' in navigator && window.isSecureContext) {
        let controladorConhecido = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (recarregar) location.reload(); else if (registro && controladorConhecido) avisarAtualizacao(); controladorConhecido = true; });
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(r => {
            registro = r;
            if (r.waiting) avisarAtualizacao();
            r.addEventListener('updatefound', () => {
                const novo = r.installing;
                novo?.addEventListener('statechange', () => { if (novo.state === 'installed' && navigator.serviceWorker.controller) avisarAtualizacao(); });
            });
        }).catch(() => { status.textContent = 'Não foi possível preparar a instalação. O sistema continua disponível pelo navegador.'; });
    }
})();
