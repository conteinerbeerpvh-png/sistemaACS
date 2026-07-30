// =======================
// INTEGRAÇÃO COM IA (OCR VIA GOOGLE VISION)
// =======================

async function escanearFicha() {
    const fileInput = document.getElementById('fichaUpload');
    const file = fileInput.files[0];
    const statusLabel = document.getElementById('scanStatus');
    const btnScan = document.getElementById('btnScan');

    if (!file) {
        alert('Selecione uma imagem ou tire uma foto da ficha primeiro!');
        return;
    }

    // Prepara a imagem para enviar pro servidor
    const formData = new FormData();
    formData.append('ficha', file);

    // Muda o visual enquanto carrega
    btnScan.disabled = true;
    btnScan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...';
    statusLabel.textContent = 'Enviando imagem para a Inteligência Artificial...';
    statusLabel.style.color = '#2196F3';
    statusLabel.style.display = 'block';

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(await mensagemDaResposta(response));
        }

        const dados = await response.json();

        // Preenche os campos se a IA encontrou os dados na foto
        if (dados.nomeCompleto) document.getElementById('nomeCompleto').value = dados.nomeCompleto;
        if (dados.cpf) document.getElementById('cpf').value = dados.cpf;
        if (dados.telefone) document.getElementById('telefone').value = dados.telefone;
        if (dados.dataNascimento) document.getElementById('dataNascimento').value = dados.dataNascimento;
        if (dados.endereco) document.getElementById('endereco').value = dados.endereco;
        if (dados.numero) document.getElementById('numero').value = dados.numero;
        if (dados.bairro) document.getElementById('bairro').value = dados.bairro;
        if (dados.doencasPreexistentes) document.getElementById('doencasPreexistentes').value = dados.doencasPreexistentes;

        statusLabel.textContent = '✅ Leitura concluída! Por favor, revise os dados antes de salvar.';
        statusLabel.style.color = '#4CAF50';
    } catch (error) {
        console.error('Erro no OCR:', error);
        statusLabel.textContent = `❌ Erro: ${error.message}`;
        statusLabel.style.color = '#f44336';
    } finally {
        // Restaura o botão
        btnScan.disabled = false;
        btnScan.innerHTML = '<i class="fas fa-magic"></i> Preencher Auto';
        
        // Dispara o evento de "input" nos campos para aplicar as máscaras automaticamente
        ['cpf', 'telefone', 'dataNascimento'].forEach(id => {
            const el = document.getElementById(id);
            if(el && el.value) el.dispatchEvent(new Event('input'));
        });
    }
}