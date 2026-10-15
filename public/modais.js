// Dialog nativo mantém o foco e torna o conteúdo de fundo inativo.
(() => {
    const retornos = new Map();
    const ordem = [];
    let posicao = null;
    function sincronizarFundo() {
        const abertos = document.querySelector('dialog[open]');
        if (abertos && posicao === null) {
            posicao = window.scrollY || 0;
            document.body.style.top = `-${posicao}px`;
            document.body.classList.add('modal-aberto');
        } else if (!abertos && posicao !== null) {
            const anterior = posicao; posicao = null;
            document.body.classList.remove('modal-aberto'); document.body.style.top = '';
            window.scrollTo({ top: anterior, behavior: 'instant' });
        }
    }
    window.abrirModal = id => {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return;
        retornos.set(dialog, document.activeElement);
        ordem.push(dialog);
        dialog.showModal(); dialog.scrollTop = 0;
        sincronizarFundo();
        const titulo = dialog.querySelector('.dialog-header h2');
        if (titulo) { titulo.tabIndex = -1; titulo.focus({ preventScroll: true }); }
    };
    window.fecharModal = id => {
        const dialog = document.getElementById(id);
        if (!dialog?.open) return;
        const topo = ordem.at(-1) === dialog;
        dialog.close();
        const i = ordem.indexOf(dialog); if (i !== -1) ordem.splice(i, 1);
        sincronizarFundo();
        const anterior = retornos.get(dialog); retornos.delete(dialog);
        if (topo && anterior?.isConnected && !anterior.closest('dialog:not([open])')) anterior.focus({ preventScroll: true });
        else if (topo && ordem.at(-1)?.open) ordem.at(-1).querySelector('.dialog-header h2')?.focus({ preventScroll: true });
    };
    window.fecharTodosModais = () => {
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
        ordem.length = 0; retornos.clear(); sincronizarFundo();
    };
    for (const dialog of document.querySelectorAll('dialog')) {
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            if (dialog.id === 'cadastroDialog') window.cancelarEdicao();
            else if (dialog.id === 'familiaCadastroManual') window.cancelarFamilia();
            else window.fecharModal(dialog.id);
        });
        dialog.addEventListener('close', sincronizarFundo);
    }
})();
