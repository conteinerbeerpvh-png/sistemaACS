const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const pasta = path.join(__dirname,'../public');
function tela() {
    const dom = new JSDOM(fs.readFileSync(path.join(pasta,'index.html'),'utf8'), { runScripts:'outside-only', url:'https://acs.example' });
    const original = dom.window.document.getElementById('nomeCompleto');
    vm.runInContext(fs.readFileSync(path.join(pasta,'etapas.js'),'utf8'),dom.getInternalVMContext());
    const d = dom.window.document, form = d.getElementById('cadastroForm');
    return { dom, d, form, original, campo: id => d.getElementById(id), etapa: () => Number(form.querySelector('.etapas-secao:not([hidden])').dataset.etapa), next: () => form.querySelector('[data-etapas-proximo]').click() };
}
function preencher(t) {
    for (const [id,v] of Object.entries({ nomeCompleto:'Pessoa Fictícia', dataNascimento:'29/02/2000', cpf:'000.000.000-00', sexo:'F', telefone:'00000000000', endereco:'Rua Fictícia', numero:'10', bairro:'Bairro Fictício', criancaDeZeroANove:'false', gestante:'false', acamado:'false', domiciliado:'false' })) t.campo(id).value=v;
}
test('etapas validam o campo visível, preservam respostas ao voltar e rejeitam datas impossíveis', () => {
    const t=tela(); try {
        assert.equal(t.campo('nomeCompleto'),t.original);
        t.next(); assert.equal(t.etapa(),0); assert.equal(t.campo('nomeCompleto').getAttribute('aria-invalid'),'true');
        preencher(t); t.campo('dataNascimento').value='31/02/2000';t.next();assert.equal(t.etapa(),0);
        assert.match(t.campo('etapas-erro-dataNascimento').textContent,/data válida/);
        t.campo('dataNascimento').value='29/02/2000';t.next();assert.equal(t.etapa(),1);
        t.form.querySelector('[data-etapas-voltar]').click(); assert.equal(t.etapa(),0);
        assert.equal(t.campo('nomeCompleto').value,'Pessoa Fictícia'); assert.equal(t.campo('telefone').value,'00000000000');
    } finally { t.dom.window.close(); }
});
test('envio só chega ao salvamento na revisão; correções e todos os campos são preservados', () => {
    const t=tela();try {
        preencher(t);t.campo('responsavelFamilia').checked=true;
        t.form.querySelector('[name="doenca"][value="Tabagista"]').checked=true;
        t.campo('lgbtqiapn').value='sim';t.form.querySelector('[name="identificacaoLgbt"][value="Bissexual"]').checked=true;
        let envios=0;t.form.addEventListener('submit',e=>{e.preventDefault();envios++;});
        t.form.dispatchEvent(new t.dom.window.Event('submit',{bubbles:true,cancelable:true})); assert.equal(envios,0);assert.equal(t.etapa(),1);
        while(t.etapa()<5)t.next();
        assert.equal(t.campo('submitBtn').hidden,false);assert.match(t.form.querySelector('.etapas-revisao').textContent,/Tabagista/);
        assert.match(t.form.querySelector('.etapas-revisao').textContent,/Bissexual/);
        t.form.querySelector('[data-corrigir-etapa="2"]').click();assert.equal(t.etapa(),2);
        t.campo('bairro').value='<img src=x onerror=alert(1)>';
        t.form.querySelector('.etapas-rever').click();assert.equal(t.etapa(),5);
        assert.equal(t.form.querySelector('.etapas-revisao img'),null);
        t.form.dispatchEvent(new t.dom.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(envios,1);
        assert.equal(t.campo('responsavelFamilia').checked,true);assert.equal(t.campo('telefone').value,'00000000000');
        t.form.reset();assert.equal(t.etapa(),0);assert.equal(t.form.querySelector('.etapas-revisao').textContent,'');
    } finally {t.dom.window.close();}
});
test('edição permite ir direto a uma etapa e valida dados obrigatórios antes de salvar',()=>{
    const t=tela();try{
        t.dom.window.reiniciarEtapas('cadastroForm',true);
        const salto=t.form.querySelector('.etapas-salto select');assert.equal(salto.closest('label').hidden,false);
        salto.value='5';salto.dispatchEvent(new t.dom.window.Event('change'));assert.equal(t.etapa(),5);
        let envios=0;t.form.addEventListener('submit',e=>{e.preventDefault();envios++;});
        t.form.dispatchEvent(new t.dom.window.Event('submit',{bubbles:true,cancelable:true}));
        assert.equal(envios,0);assert.equal(t.etapa(),0);
        t.dom.window.reiniciarEtapas('cadastroForm',false);assert.equal(salto.closest('label').hidden,true);
    }finally{t.dom.window.close();}
});
test('cadastro manual de família tem revisão e mantém responsável, ficha, microárea e endereço',()=>{
    const t=tela();try{
        const f=t.campo('familiaForm'), next=f.querySelector('[data-etapas-proximo]');
        t.campo('familiaNome').value='Família Fictícia';t.campo('familiaFicha').value='123';t.campo('familiaMicroarea').value='02';
        next.click();assert.equal(f.querySelector('.etapas-secao:not([hidden])').dataset.etapa,'1');
        t.campo('familiaResponsavel').innerHTML='<option value="pessoa">Responsável Fictício</option>';t.campo('familiaEndereco').value='Rua da Família';
        next.click();assert.equal(t.campo('salvarFamilia').hidden,false);
        for(const v of ['Família Fictícia','123','02','Responsável Fictício','Rua da Família'])assert.ok(f.querySelector('.etapas-revisao').textContent.includes(v));
    }finally{t.dom.window.close();}
});
