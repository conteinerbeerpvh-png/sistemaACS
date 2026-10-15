const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pasta = path.join(__dirname, '../public');
function ambiente(fetch = async () => new Response('rede')) {
    const eventos = {}, objetos = new Map();
    const cache = { addAll: async urls => { for (const u of urls) objetos.set(u, new Response('offline')); }, match: async r => objetos.get(typeof r === 'string' ? r : new URL(r.url).pathname)?.clone() };
    const caches = { open: async () => cache, keys: async () => ['acs-publico-antigo', 'outro-aplicativo'], delete: async nome => { objetos.set('apagou:' + nome, true); } };
    const self = { location: { origin: 'https://acs.example' }, addEventListener: (tipo, fn) => eventos[tipo] = fn, clients: { claim: async () => {} }, skipWaiting: () => {} };
    vm.runInNewContext(fs.readFileSync(path.join(pasta, 'sw.js'), 'utf8'), { self, caches, URL, fetch });
    return { eventos, objetos };
}
test('manifesto possui modo instalado, escopo e ícones PNG de tamanhos válidos', () => {
    const m = JSON.parse(fs.readFileSync(path.join(pasta, 'manifest.webmanifest')));
    assert.equal(m.display, 'standalone'); assert.equal(m.scope, '/'); assert.equal(m.start_url, '/');
    for (const icon of m.icons) {
        const png = fs.readFileSync(path.join(pasta, icon.src)); const [w,h] = icon.sizes.split('x').map(Number);
        assert.equal(png.subarray(1,4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), w); assert.equal(png.readUInt32BE(20), h);
    }
    assert.ok(m.icons.some(i => i.purpose === 'maskable'));
});
test('service worker instala somente recursos públicos e limita limpeza ao próprio cache', async () => {
    const a = ambiente(); let instalacao; a.eventos.install({ waitUntil: p => instalacao = p }); await instalacao;
    assert.ok(a.objetos.has('/offline.html'));
    assert.ok([...a.objetos.keys()].every(u => !u.startsWith('/api/') && !u.includes('index.html')));
    let ativacao; a.eventos.activate({ waitUntil: p => ativacao = p }); await ativacao;
    assert.equal(a.objetos.has('apagou:acs-publico-antigo'), true);
    assert.equal(a.objetos.has('apagou:outro-aplicativo'), false);
});
test('service worker não intercepta APIs, escritas, recursos privados ou scripts da aplicação', () => {
    const a = ambiente();
    for (const [pathname, method, authorization] of [['/api/cadastros','GET'],['/api/familias/123/cartao.pdf','GET'],['/','POST'],['/assets/icons/icon-192.png','GET','Bearer teste'],['/script.js','GET']]) {
        let interceptado = false;
        a.eventos.fetch({ request: { url: 'https://acs.example'+pathname, method, headers: new Headers(authorization ? { Authorization: authorization } : {}), mode:'cors' }, respondWith: () => interceptado = true });
        assert.equal(interceptado, false, pathname);
    }
});
test('sem conexão a navegação recebe página pública e não fichas antigas', async () => {
    const a = ambiente(async () => { throw new Error('offline'); });
    let p; a.eventos.install({ waitUntil: v => p = v }); await p;
    a.eventos.fetch({ request: { url:'https://acs.example/', method:'GET', headers:new Headers(), mode:'navigate' }, respondWith: v => p = v });
    assert.equal(await (await p).text(), 'offline');
    assert.equal(a.objetos.has('/'), false);
});
