let cadastros = [];
let editandoId = null;
let token = localStorage.getItem('acs_token');
let usuario = JSON.parse(localStorage.getItem('acs_usuario') || 'null');

const $ = id => document.getElementById(id);
const texto = valor => String(valor ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
function headers(json = false) { return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }
async function requisicao(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', headers: { ...headers(Boolean(options.body && !(options.body instanceof FormData))), ...(options.headers || {}) } });
    if (response.status === 401 && token) sair();
    return response;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('O servidor não respondeu em 8 segundos. Tente novamente.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function mensagem(response) { return (await response.json().catch(() => ({}))).message || `Erro do servidor (HTTP ${response.status})`; }

function mostrarApp() { 
  $('authMensagem').textContent = ''; 
  $('authScreen').hidden = true; 
  $('authScreen').style.display = 'none'; 
  $('appScreen').hidden = false; 
  $('appScreen').style.display = 'block'; 
  $('usuarioLogado').textContent = `Olá, ${usuario.nome}`; 
  buscarCadastros(); 
}

function sair() { 
  localStorage.removeItem('acs_token'); 
  localStorage.removeItem('acs_usuario'); 
  token = null; 
  usuario = null; 
  $('appScreen').hidden = true; 
  $('appScreen').style.display = 'none'; 
  $('authScreen').hidden = false; 
  $('authScreen').style.display = ''; 
  $('loginForm').reset(); 
}

function salvarSessao(dados) { token = dados.token; usuario = dados.usuario; localStorage.setItem('acs_token', token); localStorage.setItem('acs_usuario', JSON.stringify(usuario)); mostrarApp(); }

$('toggleAuth').addEventListener('click', () => { const criando = $('registerForm').hidden; $('registerForm').hidden = !criando; $('loginForm').hidden = criando; $('toggleAuth').textContent = criando ? 'Voltar para o login' : 'Criar novo usuário e senha'; $('authDescricao').textContent = criando ? 'Crie uma conta para manter seus cadastros separados.' : 'Entre para acessar seus cadastros individuais.'; $('authMensagem').textContent = ''; });
$('loginForm').addEventListener('submit', async event => { event.preventDefault(); const botao = $('loginForm').querySelector('button'); botao.disabled = true; $('authMensagem').textContent = 'Entrando...'; try { const response = await requisicao('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario: $('loginUsuario').value.trim(), senha: $('loginSenha').value }) }); if (!response.ok) return $('authMensagem').textContent = await mensagem(response); salvarSessao(await response.json()); } catch (error) { $('authMensagem').textContent = error.message || 'Não foi possível acessar o servidor. Tente novamente.'; } finally { botao.disabled = false; } });
$('registerForm').addEventListener('submit', async event => { event.preventDefault(); $('authMensagem').textContent = 'Criando conta...'; try { const response = await requisicao('/api/auth/registrar', { method: 'POST', body: JSON.stringify({ nome: $('novoNome').value, usuario: $('novoUsuario').value, senha: $('novaSenha').value }) }); if (!response.ok) return $('authMensagem').textContent = await mensagem(response); salvarSessao(await response.json()); } catch (_) { $('authMensagem').textContent = 'Não foi possível acessar o servidor. Verifique se a nova versão foi publicada.'; } });
$('logoutBtn').addEventListener('click', sair);

function mascaraData() { 
  let v = $('dataNascimento').value.replace(/\D/g, ''); 
  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); 
  if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5, 9); 
  $('dataNascimento').value = v; 
  
  if (v.length === 10) {
    const [dia, mes, ano] = v.split('/');
    const hoje = new Date();
    const nasc = new Date(ano, mes - 1, dia);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
        idade--;
    }
    $('criancaDeZeroANove').value = (idade >= 0 && idade <= 9) ? 'true' : 'false';
  } else {
    $('criancaDeZeroANove').value = '';
  }
}

function mascaraCpf() { let v = $('cpf').value.replace(/\D/g, '').slice(0, 11); $('cpf').value = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
function mascaraTelefone() { let v = $('telefone').value.replace(/\D/g, '').slice(0, 11); $('telefone').value = v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2'); }
$('dataNascimento').addEventListener('input', mascaraData); $('cpf').addEventListener('input', mascaraCpf); $('telefone').addEventListener('input', mascaraTelefone);
function formatarData(data) { if (!data) return 'Não informada'; const [ano, mes, dia] = String(data).split('T')[0].split('-'); return dia ? `${dia}/${mes}/${ano}` : data; }
function valorBooleano(id) { return $(id).value === 'true'; }
function dadosFormulario() { const [dia, mes, ano] = $('dataNascimento').value.split('/'); return { nomeCompleto: $('nomeCompleto').value.trim(), dataNascimento: `${ano}-${mes}-${dia}`, cpf: $('cpf').value.trim(), telefone: $('telefone').value.trim(), endereco: $('endereco').value.trim(), numero: $('numero').value.trim(), bairro: $('bairro').value.trim(), sexo: $('sexo').value, criancaDeZeroANove: valorBooleano('criancaDeZeroANove'), gestante: valorBooleano('gestante'), acamado: valorBooleano('acamado'), domiciliado: valorBooleano('domiciliado'), doencasPreexistentes: [...document.querySelectorAll('input[name="doenca"]:checked')].map(item => item.value), outrasDoencas: $('outrasDoencas').value.trim() }; }

async function buscarCadastros() { 
    const search = $('searchInput').value.trim(); 
    $('cadastrosList').innerHTML = '<p class="loading">Carregando...</p>'; 
    const response = await requisicao(`/api/cadastros${search ? `?search=${encodeURIComponent(search)}` : ''}`); 
    if (!response.ok) { $('cadastrosList').textContent = await mensagem(response); return; } 
    cadastros = await response.json(); 
    $('statsBar').hidden = false; 
    $('resultCount').textContent = `Total: ${cadastros.length} cadastro(s)`; 
    exibirCadastros(); 
}

function exibirCadastros() { 
    if (!cadastros.length) { 
        $('cadastrosList').innerHTML = '<p class="loading">Nenhum cadastro encontrado.</p>'; 
        if ($('actionsBar')) $('actionsBar').hidden = true;
        return; 
    } 
    
    if ($('actionsBar')) $('actionsBar').hidden = false;
    
    $('cadastrosList').innerHTML = cadastros.map(c => { 
        const doencas = [...(c.doencasPreexistentes || []), c.outrasDoencas].filter(Boolean).join(', ') || 'Nenhuma'; 
        return `<article class="cadastro-item">
            <h3 style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="select-cadastro" value="${c._id}" style="width:18px; height:18px; cursor:pointer;"> 
                <span><i class="fas fa-user"></i> ${texto(c.nomeCompleto)}</span>
            </h3>
            <p><strong>CPF:</strong> ${texto(c.cpf)}</p>
            <p><strong>Telefone:</strong> ${texto(c.telefone)}</p>
            <p><strong>Sexo:</strong> ${c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : 'Não informado'} · <strong>Criança 0–9:</strong> ${c.criancaDeZeroANove ? 'Sim' : 'Não'} · <strong>Gestante:</strong> ${c.gestante ? 'Sim' : 'Não'}</p>
            <p><strong>Acamado:</strong> ${c.acamado ? 'Sim' : 'Não'} · <strong>Domiciliado:</strong> ${c.domiciliado ? 'Sim' : 'Não'}</p>
            <p><strong>Endereço:</strong> ${texto(c.endereco)}, Nº ${texto(c.numero)} — ${texto(c.bairro)}</p>
            <p><strong>Doenças:</strong> ${texto(doencas)}</p>
            <p><strong>Nascimento:</strong> ${formatarData(c.dataNascimento)}</p>
            <div class="cadastro-actions">
                <button class="btn-whatsapp" data-whatsapp="${c.telefone}"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                <button class="btn-edit" data-editar="${c._id}"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-print" data-imprimir="${c._id}"><i class="fas fa-print"></i> Imprimir</button>
                <button class="btn-delete" data-excluir="${c._id}"><i class="fas fa-trash"></i> Excluir</button>
            </div>
        </article>`; 
    }).join(''); 
}

$('cadastrosList').addEventListener('click', event => { 
    const target = event.target.closest('button');
    if (!target) return;
    
    const id = target.dataset.editar || target.dataset.excluir || target.dataset.imprimir; 
    
    if (target.dataset.whatsapp) {
        const numero = target.dataset.whatsapp.replace(/\D/g, '');
        if (numero) window.open(`https://wa.me/55${numero}`, '_blank');
        return;
    }

    if (!id) return; 
    if (target.dataset.editar) editarCadastro(id); 
    else if (target.dataset.imprimir) imprimirCadastro(id); 
    else if (target.dataset.excluir) excluirCadastro(id); 
});

function imprimirCadastro(id) { 
    const c = cadastros.find(item => item._id === id); 
    if (!c) return; 
    imprimirVarios([c]);
}

function imprimirVarios(lista) {
    if (!lista || !lista.length) return alert('Nenhum cadastro selecionado.');
    const janela = window.open('', '_blank');
    if (!janela) return alert('Permita pop-ups para imprimir.');
    
    let html = `<!doctype html><html><head><title>Exportar Cadastros</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#222}.ficha{max-width:180mm;margin:auto; page-break-after: always; padding-bottom: 15mm;}h1{color:#4f62c8;margin-bottom:3mm}h2{border-bottom:2px solid #667eea;padding-bottom:3mm}.linha{margin:5mm 0;font-size:12pt}.rodape{margin-top:15mm;font-size:9pt;color:#666}</style></head><body>`;
    
    lista.forEach(c => {
        const doencas = [...(c.doencasPreexistentes || []), c.outrasDoencas].filter(Boolean).join(', ') || 'Nenhuma';
        html += `<main class="ficha"><h1>ACS Cadastro</h1><p>Ficha de Cadastro Individual</p><h2>${texto(c.nomeCompleto)}</h2><p class="linha"><b>CPF:</b> ${texto(c.cpf)}</p><p class="linha"><b>Telefone:</b> ${texto(c.telefone)}</p><p class="linha"><b>Data de nascimento:</b> ${formatarData(c.dataNascimento)}</p><p class="linha"><b>Sexo:</b> ${c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : 'Não informado'}</p><p class="linha"><b>Criança de 0 a 9 anos:</b> ${c.criancaDeZeroANove ? 'Sim' : 'Não'}</p><p class="linha"><b>Gestante:</b> ${c.gestante ? 'Sim' : 'Não'}</p><p class="linha"><b>Acamado:</b> ${c.acamado ? 'Sim' : 'Não'}</p><p class="linha"><b>Domiciliado:</b> ${c.domiciliado ? 'Sim' : 'Não'}</p><p class="linha"><b>Endereço:</b> ${texto(c.endereco)}, Nº ${texto(c.numero)} — ${texto(c.bairro)}</p><p class="linha"><b>Doenças pré-existentes:</b> ${texto(doencas)}</p><p class="rodape">Gerado em ${new Date().toLocaleString('pt-BR')}</p></main>`;
    });
    
    html += `</body></html>`;
    janela.document.write(html);
    janela.document.close();
    janela.onload = () => janela.print();
}

$('cadastroForm').addEventListener('submit', async event => { event.preventDefault(); if ($('dataNascimento').value.length !== 10) return alert('Digite a data no formato DD/MM/AAAA.'); const response = await requisicao(editandoId ? `/api/cadastros/${editandoId}` : '/api/cadastros', { method: editandoId ? 'PUT' : 'POST', body: JSON.stringify(dadosFormulario()) }); if (!response.ok) return alert(await mensagem(response)); cancelarEdicao(); buscarCadastros(); });
function editarCadastro(id) { const c = cadastros.find(item => item._id === id); if (!c) return; editandoId = id; $('nomeCompleto').value = c.nomeCompleto; $('dataNascimento').value = formatarData(c.dataNascimento); $('cpf').value = c.cpf; $('telefone').value = c.telefone; $('endereco').value = c.endereco; $('numero').value = c.numero; $('bairro').value = c.bairro; $('sexo').value = c.sexo; $('criancaDeZeroANove').value = c.criancaDeZeroANove !== undefined ? String(c.criancaDeZeroANove) : ''; $('gestante').value = c.gestante !== undefined ? String(c.gestante) : ''; $('acamado').value = c.acamado !== undefined ? String(c.acamado) : ''; $('domiciliado').value = c.domiciliado !== undefined ? String(c.domiciliado) : ''; $('outrasDoencas').value = c.outrasDoencas || ''; document.querySelectorAll('input[name="doenca"]').forEach(item => item.checked = c.doencasPreexistentes?.includes(item.value)); $('formTitle').textContent = 'Editar Cadastro'; $('cancelBtn').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function cancelarEdicao() { editandoId = null; $('cadastroForm').reset(); $('formTitle').textContent = 'Novo Cadastro'; $('cancelBtn').hidden = true; }
async function excluirCadastro(id) { if (!confirm('Excluir este cadastro?')) return; const response = await requisicao(`/api/cadastros/${id}`, { method: 'DELETE' }); if (!response.ok) return alert(await mensagem(response)); buscarCadastros(); }
$('cancelBtn').addEventListener('click', cancelarEdicao); $('buscarBtn').addEventListener('click', buscarCadastros); $('limparBtn').addEventListener('click', () => { $('searchInput').value = ''; buscarCadastros(); }); $('searchInput').addEventListener('keydown', event => { if (event.key === 'Enter') buscarCadastros(); });

if ($('btnExportarTodos')) {
    $('btnExportarTodos').addEventListener('click', () => imprimirVarios(cadastros));
}
if ($('btnExportarSelecionados')) {
    $('btnExportarSelecionados').addEventListener('click', () => {
        const selecionados = [...document.querySelectorAll('.select-cadastro:checked')].map(cb => cb.value);
        if (selecionados.length === 0) return alert('Selecione pelo menos um cadastro marcando a caixinha ao lado do nome.');
        const lista = cadastros.filter(c => selecionados.includes(c._id));
        imprimirVarios(lista);
    });
}

const btnVoz = $('btnScan');
if (btnVoz) {
    btnVoz.innerHTML = '<i class="fas fa-microphone"></i> Preencher por voz';
    if ($('fichaUpload')) {
        $('fichaUpload').style.display = 'none';
        const labelFicha = document.querySelector('label[for="fichaUpload"]');
        if (labelFicha) labelFicha.innerHTML = '<i class="fas fa-microphone"></i> Dite os dados do paciente';
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            $('scanStatus').textContent = 'Ouvindo... Pode falar.';
            $('scanStatus').style.display = 'block';
            $('scanStatus').style.color = '#e74c3c';
            btnVoz.style.background = '#e74c3c';
            btnVoz.innerHTML = '<i class="fas fa-record-vinyl"></i> Gravando...';
        };

        recognition.onresult = (event) => {
            const fala = event.results[0][0].transcript.toLowerCase();
            $('scanStatus').textContent = 'Processando texto...';
            $('scanStatus').style.color = '#1976D2';

            const extrair = (regex) => {
                const match = fala.match(regex);
                return match ? match[1].trim() : '';
            };

            const nomeMatch = fala.match(/nome\s+completo\s+(.*?)(?=\s+data|\s+cpf|\s+telefone|\s+sexo|\s+gestante|\s+acamado|\s+domiciliado|\s+endereço|\s+bairro|$)/i);
            if (nomeMatch) $('nomeCompleto').value = nomeMatch[1].replace(/(^\w|\s\w)/g, m => m.toUpperCase());

            const dataMatch = extrair(/data de nascimento\s+([\d/]+|.*?(?=\s+cpf|\s+telefone|\s+sexo|\s+gestante|\s+acamado|\s+domiciliado|\s+endereço|\s+bairro|$))/i);
            if (dataMatch) {
                $('dataNascimento').value = dataMatch.replace(/[^\d]/g, '');
                mascaraData();
            }

            const cpfMatch = extrair(/cpf\s+([\d.-]+|.*?(?=\s+telefone|\s+sexo|\s+gestante|\s+acamado|\s+domiciliado|\s+endereço|\s+bairro|$))/i);
            if (cpfMatch) {
                $('cpf').value = cpfMatch.replace(/[^\d]/g, '');
                mascaraCpf();
            }

            const telefoneMatch = extrair(/telefone\s+([\d\s()-]+|.*?(?=\s+sexo|\s+gestante|\s+acamado|\s+domiciliado|\s+endereço|\s+bairro|$))/i);
            if (telefoneMatch) {
                $('telefone').value = telefoneMatch.replace(/[^\d]/g, '');
                mascaraTelefone();
            }

            if (fala.includes('sexo masculino') || fala.includes('masculino')) {
                $('sexo').value = 'M';
            } else if (fala.includes('sexo feminino') || fala.includes('feminino')) {
                $('sexo').value = 'F';
            }

            if (fala.includes('não sou gestante') || fala.includes('não é gestante')) {
                $('gestante').value = 'false';
            } else if (fala.includes('sou gestante') || fala.match(/é gestante\s+sim/)) {
                $('gestante').value = 'true';
            }

            if (fala.includes('não sou acamado') || fala.includes('não é acamado')) {
                $('acamado').value = 'false';
            } else if (fala.includes('sou acamado') || fala.match(/é acamado\s+sim/)) {
                $('acamado').value = 'true';
            }

            if (fala.includes('não sou domiciliado') || fala.includes('não é domiciliado')) {
                $('domiciliado').value = 'false';
            } else if (fala.includes('sou domiciliado') || fala.match(/é domiciliado\s+sim/)) {
                $('domiciliado').value = 'true';
            }

            const enderecoMatch = fala.match(/endereço\s+(.*?)(?=\s+número|\s+bairro|$)/i);
            if (enderecoMatch) $('endereco').value = enderecoMatch[1].replace(/(^\w|\s\w)/g, m => m.toUpperCase());

            const numeroMatch = fala.match(/número\s+(\d+)/i);
            if (numeroMatch) $('numero').value = numeroMatch[1];

            const bairroMatch = fala.match(/bairro\s+(.*?)(?=\s+doença|$)/i);
            if (bairroMatch) $('bairro').value = bairroMatch[1].replace(/(^\w|\s\w)/g, m => m.toUpperCase());

            $('scanStatus').textContent = 'Preenchimento concluído! Revise os dados.';
            $('scanStatus').style.color = '#4CAF50';
            
            btnVoz.innerHTML = '<i class="fas fa-microphone"></i> Preencher por voz';
            btnVoz.style.background = '';
        };

        recognition.onerror = (event) => {
            $('scanStatus').textContent = 'Erro ao ouvir: tente novamente.';
            $('scanStatus').style.color = '#c0392b';
            btnVoz.innerHTML = '<i class="fas fa-microphone"></i> Preencher por voz';
            btnVoz.style.background = '';
        };

        recognition.onend = () => {
            if (btnVoz.textContent.includes('Gravando')) {
                btnVoz.innerHTML = '<i class="fas fa-microphone"></i> Preencher por voz';
                btnVoz.style.background = '';
            }
        };

        btnVoz.addEventListener('click', () => {
            try { recognition.start(); } catch (e) {} 
        });

    } else {
        $('scanStatus').textContent = 'Seu navegador não suporta comando de voz.';
        $('scanStatus').style.display = 'block';
        $('scanStatus').style.color = '#c0392b';
        btnVoz.disabled = true;
    }
}

if (token && usuario) mostrarApp();
