let cadastros = [];
let editandoId = null;

async function buscarComTimeout(url, opcoes = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        return await fetch(url, { ...opcoes, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('O servidor demorou mais de 15 segundos para responder. Verifique o MongoDB no Render.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function mensagemDaResposta(response) {
    const erro = await response.json().catch(() => null);
    return erro?.message || `Erro do servidor (HTTP ${response.status})`;
}

// Máscaras
document.getElementById('cpf').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    e.target.value = value;
});

document.getElementById('telefone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    }
    e.target.value = value;
});

// Formatar data
function formatarData(data) {
    if (!data) return 'Não informada';
    return new Date(data).toLocaleDateString('pt-BR');
}

// Função principal de busca
async function buscarCadastros() {
    const searchInput = document.getElementById('searchInput');
    const search = searchInput.value.trim();
    const listaDiv = document.getElementById('cadastrosList');
    const statsBar = document.getElementById('statsBar');
    const resultCount = document.getElementById('resultCount');
    
    // Mostrar loading
    listaDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Carregando...</p></div>';
    
    try {
        const url = search 
            ? `/api/cadastros?search=${encodeURIComponent(search)}`
            : '/api/cadastros/todos';
            
        const response = await buscarComTimeout(url);
        
        if (!response.ok) {
            throw new Error(await mensagemDaResposta(response));
        }
        
        cadastros = await response.json();
        
        // Atualizar stats
        if (search) {
            statsBar.style.display = 'block';
            resultCount.innerHTML = `<i class="fas fa-info-circle"></i> Encontrados: <strong>${cadastros.length}</strong> cadastro(s) para "<strong>${search}</strong>"`;
        } else {
            statsBar.style.display = 'block';
            resultCount.innerHTML = `<i class="fas fa-info-circle"></i> Total: <strong>${cadastros.length}</strong> cadastro(s)`;
        }
        
        exibirCadastros(cadastros);
        
    } catch (error) {
        console.error('Erro:', error);
        listaDiv.textContent = `Erro ao carregar cadastros: ${error.message}`;
        listaDiv.style.cssText = 'text-align: center; color: #e74c3c; padding: 20px;';
        statsBar.style.display = 'none';
    }
}

// Exibir cadastros
function exibirCadastros(lista) {
    const container = document.getElementById('cadastrosList');
    
    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #999;">
                <i class="fas fa-inbox" style="font-size: 3rem; display: block; margin-bottom: 10px;"></i>
                <p>Nenhum cadastro encontrado</p>
            </div>`;
        return;
    }
    
    container.innerHTML = lista.map(cadastro => `
        <div class="cadastro-item" id="cadastro-${cadastro._id}">
            <h3><i class="fas fa-user"></i> ${cadastro.nomeCompleto}</h3>
            <p><strong>📋 CPF:</strong> ${cadastro.cpf || 'Não informado'}</p>
            <p><strong>📱 Telefone:</strong> ${cadastro.telefone || 'Não informado'}</p>
            <p><strong>📍 Endereço:</strong> ${cadastro.endereco || ''}, Nº ${cadastro.numero || 'S/N'}</p>
            <p><strong>🏘️ Bairro:</strong> ${cadastro.bairro || 'Não informado'}</p>
            <p><strong>🏥 Doenças:</strong> ${cadastro.doencasPreexistentes || 'Nenhuma'}</p>
            <p><strong>🎂 Nascimento:</strong> ${formatarData(cadastro.dataNascimento)}</p>
            <div class="cadastro-actions">
                <button class="btn-edit" onclick="editarCadastro('${cadastro._id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-delete" onclick="deletarCadastro('${cadastro._id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
                <button class="btn-whatsapp" onclick="enviarWhatsApp('${cadastro.telefone}', '${cadastro.nomeCompleto}')">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button class="btn-print" onclick="imprimirCadastro('${cadastro._id}')">
                    <i class="fas fa-print"></i> Imprimir
                </button>
            </div>
        </div>
    `).join('');
}

// Salvar/Atualizar cadastro
document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const dados = {
        nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
        dataNascimento: document.getElementById('dataNascimento').value,
        cpf: document.getElementById('cpf').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        endereco: document.getElementById('endereco').value.trim(),
        numero: document.getElementById('numero').value.trim(),
        bairro: document.getElementById('bairro').value.trim(),
        doencasPreexistentes: document.getElementById('doencasPreexistentes').value.trim() || 'Nenhuma'
    };
    
    // Validação básica
    if (!dados.nomeCompleto || !dados.dataNascimento || !dados.cpf || !dados.telefone || !dados.endereco || !dados.numero || !dados.bairro) {
        alert('Por favor, preencha todos os campos obrigatórios (*)');
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    try {
        let response;
        
        if (editandoId) {
            // Atualizar
            response = await buscarComTimeout(`/api/cadastros/${editandoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
        } else {
            // Criar novo
            response = await buscarComTimeout('/api/cadastros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
        }
        
        if (response.ok) {
            alert(editandoId ? '✅ Cadastro atualizado com sucesso!' : '✅ Cadastro salvo com sucesso!');
            cancelarEdicao();
            buscarCadastros();
        } else {
            alert('Erro: ' + await mensagemDaResposta(response));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Salvar Cadastro';
    }
});

// Editar cadastro
function editarCadastro(id) {
    const cadastro = cadastros.find(c => c._id === id);
    if (!cadastro) {
        alert('Cadastro não encontrado!');
        return;
    }
    
    editandoId = id;
    
    // Preencher formulário
    document.getElementById('nomeCompleto').value = cadastro.nomeCompleto || '';
    document.getElementById('dataNascimento').value = cadastro.dataNascimento ? cadastro.dataNascimento.split('T')[0] : '';
    document.getElementById('cpf').value = cadastro.cpf || '';
    document.getElementById('telefone').value = cadastro.telefone || '';
    document.getElementById('endereco').value = cadastro.endereco || '';
    document.getElementById('numero').value = cadastro.numero || '';
    document.getElementById('bairro').value = cadastro.bairro || '';
    document.getElementById('doencasPreexistentes').value = cadastro.doencasPreexistentes || '';
    
    // Mudar interface
    document.getElementById('formTitle').textContent = 'Editar Cadastro';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-sync"></i> Atualizar Cadastro';
    document.getElementById('cancelBtn').style.display = 'block';
    
    // Scroll para o formulário
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}

// Cancelar edição
function cancelarEdicao() {
    editandoId = null;
    document.getElementById('cadastroForm').reset();
    document.getElementById('formTitle').textContent = 'Novo Cadastro';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Salvar Cadastro';
    document.getElementById('cancelBtn').style.display = 'none';
}

// Deletar cadastro
async function deletarCadastro(id) {
    if (!confirm('Tem certeza que deseja excluir este cadastro?\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    try {
        const response = await buscarComTimeout(`/api/cadastros/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Cadastro excluído com sucesso!');
            buscarCadastros();
        } else {
            alert('❌ Erro ao excluir cadastro');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro de conexão');
    }
}

// Imprimir cadastro individual
function imprimirCadastro(id) {
    const cadastro = cadastros.find(c => c._id === id);
    if (!cadastro) {
        alert('Cadastro não encontrado!');
        return;
    }
    
    const conteudo = document.createElement('div');
    conteudo.innerHTML = `
        <div style="padding: 30px; font-family: Arial; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #667eea; margin-bottom: 5px;">ACS Cadastro</h1>
                <p style="color: #666;">Ficha de Cadastro Individual</p>
                <hr style="border: 2px solid #667eea;">
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h2 style="color: #333; margin-bottom: 15px;">${cadastro.nomeCompleto}</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <p><strong>CPF:</strong> ${cadastro.cpf}</p>
                        <p><strong>Telefone:</strong> ${cadastro.telefone}</p>
                        <p><strong>Data Nasc.:</strong> ${formatarData(cadastro.dataNascimento)}</p>
                    </div>
                    <div>
                        <p><strong>Endereço:</strong> ${cadastro.endereco}, Nº ${cadastro.numero}</p>
                        <p><strong>Bairro:</strong> ${cadastro.bairro}</p>
                        <p><strong>Doenças:</strong> ${cadastro.doencasPreexistentes || 'Nenhuma'}</p>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
                <p>Documento gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    `;
    
    html2pdf()
        .set({
            margin: 10,
            filename: `cadastro-${cadastro.nomeCompleto.replace(/\s+/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(conteudo)
        .save();
}

// Exportar PDF dos resultados atuais
function exportarPDF() {
    if (cadastros.length === 0) {
        alert('Nenhum cadastro para exportar!');
        return;
    }
    
    const conteudo = document.createElement('div');
    conteudo.innerHTML = `
        <div style="padding: 30px; font-family: Arial;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #667eea;">Relatório de Cadastros ACS</h1>
                <p>Total de cadastros: ${cadastros.length}</p>
                <hr style="border: 2px solid #667eea;">
            </div>
            
            ${cadastros.map((cadastro, index) => `
                <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid;">
                    <h3 style="color: #333;">#${index + 1} - ${cadastro.nomeCompleto}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                        <p><strong>CPF:</strong> ${cadastro.cpf}</p>
                        <p><strong>Telefone:</strong> ${cadastro.telefone}</p>
                        <p><strong>Endereço:</strong> ${cadastro.endereco}, Nº ${cadastro.numero}</p>
                        <p><strong>Bairro:</strong> ${cadastro.bairro}</p>
                        <p><strong>Data Nasc.:</strong> ${formatarData(cadastro.dataNascimento)}</p>
                        <p><strong>Doenças:</strong> ${cadastro.doencasPreexistentes || 'Nenhuma'}</p>
                    </div>
                </div>
            `).join('')}
            
            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    `;
    
    html2pdf()
        .set({
            margin: 10,
            filename: 'cadastros-acs.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(conteudo)
        .save();
}

// Exportar todos os cadastros
async function exportarTodosPDF() {
    try {
        const response = await buscarComTimeout('/api/cadastros/todos');
        const todosCadastros = await response.json();
        
        if (todosCadastros.length === 0) {
            alert('Nenhum cadastro no banco de dados!');
            return;
        }
        
        const conteudo = document.createElement('div');
        conteudo.innerHTML = `
            <div style="padding: 30px; font-family: Arial;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #667eea;">Relatório Completo ACS</h1>
                    <p>Total de cadastros: ${todosCadastros.length}</p>
                    <hr style="border: 2px solid #667eea;">
                </div>
                
                ${todosCadastros.map((cadastro, index) => `
                    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; page-break-inside: avoid;">
                        <h3 style="color: #333;">#${index + 1} - ${cadastro.nomeCompleto}</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                            <p><strong>CPF:</strong> ${cadastro.cpf}</p>
                            <p><strong>Telefone:</strong> ${cadastro.telefone}</p>
                            <p><strong>Endereço:</strong> ${cadastro.endereco}, Nº ${cadastro.numero}</p>
                            <p><strong>Bairro:</strong> ${cadastro.bairro}</p>
                            <p><strong>Data Nasc.:</strong> ${formatarData(cadastro.dataNascimento)}</p>
                            <p><strong>Doenças:</strong> ${cadastro.doencasPreexistentes || 'Nenhuma'}</p>
                        </div>
                    </div>
                `).join('')}
                
                <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
        
        html2pdf()
            .set({
                margin: 10,
                filename: 'relatorio-completo-acs.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(conteudo)
            .save();
            
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('Erro ao exportar PDF. Tente novamente.');
    }
}

// Enviar WhatsApp
function enviarWhatsApp(telefone, nome) {
    if (!telefone) {
        alert('Telefone não informado!');
        return;
    }
    const numero = telefone.replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá ${nome}! Sou ACS da sua região. Como posso ajudar?`);
    window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
}

// Limpar busca
function limparBusca() {
    document.getElementById('searchInput').value = '';
    buscarCadastros();
}

// Buscar ao pressionar Enter
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        buscarCadastros();
    }
});

// Carregar cadastros ao iniciar
document.addEventListener('DOMContentLoaded', function() {
    buscarCadastros();
});
