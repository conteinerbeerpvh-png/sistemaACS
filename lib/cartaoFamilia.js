const PDFDocument = require('pdfkit');
const path = require('path');
const Cadastro = require('../models/cadastro');
const Familia = require('../models/familia');
const { enderecoCompleto } = require('./dadosFamilia');
const configuracao = { prefeitura: 'PREFEITURA MUNICIPAL DE PORTO VELHO', secretaria: 'SECRETARIA MUNICIPAL DE SAÚDE', unidade: 'USF NOVA FLORESTA', equipe: 'MONTE SINAI', acs: 'DIANA FREIRE' };
const linhasPorVerso = 8;
async function dadosCartao(id, usuarioId) {
    const familia = await Familia.findOne({ _id: id, usuarioId }).lean();
    if (!familia) return null;
    const pessoas = await Cadastro.find({ usuarioId, _id: { $in: familia.membros.map(m => m.cadastroId) } }).lean();
    const porId = new Map(pessoas.map(p => [String(p._id), p]));
    const responsavel = porId.get(String(familia.responsavelId));
    if (!responsavel) throw new Error('Responsável não encontrado.');
    return {
        ...configuracao, id: String(familia._id), nomeFamilia: familia.nome,
        data: new Date(familia.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' }),
        numeroFicha: familia.numeroFicha || '', microarea: familia.microarea || '',
        responsavel: responsavel.nomeCompleto, endereco: responsavel.endereco, numero: responsavel.numero,
        bairro: responsavel.bairro, telefone: responsavel.telefone, enderecoCompleto: enderecoCompleto(responsavel),
        membros: familia.membros.map(m => porId.get(String(m.cadastroId))).filter(Boolean).map(p => ({ nome: p.nomeCompleto, cpf: p.cpf })),
        linhasPorVerso
    };
}

function gerarCartaoPDF(dados) {
    return new Promise((resolve, reject) => {
        const largura = 419.528, altura = 297.638; // A6 horizontal, 148 x 105 mm.
        const doc = new PDFDocument({ size: [largura, altura], margin: 0, autoFirstPage: false,
            info: { Title: 'Cartão da família', Author: 'ACS Cadastro', Subject: 'Identificação familiar' } });
        const partes = [];
        doc.on('data', p => partes.push(p)); doc.on('end', () => resolve(Buffer.concat(partes))); doc.on('error', reject);
        doc.registerFont('CartaoRegular', path.join(__dirname, '../public/assets/fonts/DejaVuSans.ttf'));
        doc.registerFont('CartaoBold', path.join(__dirname, '../public/assets/fonts/DejaVuSans-Bold.ttf'));
        const x = 16, w = largura - 32;
        function texto(valor, tx, ty, tw, th, tamanho = 10, negrito = false, align = 'left') {
            const conteudo = String(valor || 'Não informado');
            doc.font(negrito ? 'CartaoBold' : 'CartaoRegular');
            let fonte = tamanho;
            while (fonte > 6.5 && doc.fontSize(fonte).heightOfString(conteudo, { width: tw }) > th) fonte -= 0.5;
            doc.fontSize(fonte).fillColor('#111').text(conteudo, tx, ty, { width: tw, height: th, ellipsis: true, align });
        }
        function pagina() {
            doc.addPage(); doc.lineWidth(1.6).rect(9, 9, largura - 18, altura - 18).stroke();
            doc.lineWidth(0.6).rect(13, 13, largura - 26, altura - 26).stroke();
        }
        function linha(rotulo, valor, y, h = 27) {
            doc.lineWidth(0.5).moveTo(x, y + h).lineTo(x + w, y + h).stroke();
            texto(rotulo, x + 5, y + 8, 58, h - 8, 9, true);
            texto(valor, x + 66, y + 6, w - 73, h - 8, 10.5, true);
        }
        pagina();
        const assets = path.join(__dirname, '../public/assets');
        doc.image(path.join(assets, 'brasao-porto-velho.png'), x + 4, 20, { fit: [52, 45], align: 'center', valign: 'center' });
        doc.image(path.join(assets, 'saude-familia.png'), largura - 69, 18, { fit: [47, 48], align: 'center', valign: 'center' });
        texto(dados.prefeitura, x + 62, 24, w - 124, 23, 9.5, true, 'center');
        texto(dados.secretaria, x + 62, 46, w - 124, 15, 8.5, true, 'center');
        texto(dados.unidade, x + 62, 62, w - 124, 14, 9.5, true, 'center');
        linha('DATA:', dados.data, 80, 25);
        linha('EQUIPE:', dados.equipe, 105, 27);
        linha('ACS:', dados.acs, 132, 27);
        linha('RESP.:', dados.responsavel, 159, 32);
        linha('END.:', dados.endereco, 191, 32);
        texto('Nº:', x + 5, 232, 22, 13, 9, true); texto(dados.numero, x + 29, 230, 62, 17, 10, true);
        texto('BAIRRO:', x + 99, 232, 48, 13, 9, true); texto(dados.bairro, x + 152, 230, w - 160, 20, 10, true);
        doc.moveTo(x, 252).lineTo(x + w, 252).stroke();
        texto('Ao procurar a unidade de saúde, leve este cartão e um documento de identificação.', x + 5, 259, w - 10, 16, 7.5, false, 'center');
        const versos = Math.max(1, Math.ceil(dados.membros.length / linhasPorVerso));
        for (let numeroVerso = 0; numeroVerso < versos; numeroVerso++) {
            pagina();
            texto(dados.nomeFamilia, x + 5, 21, w - 10, 20, 10.5, true, 'center');
            texto(`FAMILIARES - ${numeroVerso + 1}/${versos}`, x + 5, 43, w - 10, 13, 8, false, 'center');
            const top = 63, rowH = 24, colunaCPF = 122;
            doc.lineWidth(0.7).rect(x, top, w, rowH * 9).stroke();
            doc.moveTo(x + colunaCPF, top).lineTo(x + colunaCPF, top + rowH * 9).stroke();
            texto('CPF', x + 5, top + 7, colunaCPF - 10, 14, 10, true, 'center');
            texto('NOME', x + colunaCPF + 6, top + 7, w - colunaCPF - 12, 14, 10, true, 'center');
            const membros = dados.membros.slice(numeroVerso * linhasPorVerso, (numeroVerso + 1) * linhasPorVerso);
            for (let i = 0; i < 8; i++) {
                const y = top + rowH * (i + 1);
                doc.moveTo(x, y).lineTo(x + w, y).stroke();
                if (membros[i]) {
                    texto(membros[i].cpf, x + 5, y + 7, colunaCPF - 10, rowH - 8, 9.5, false, 'center');
                    texto(membros[i].nome, x + colunaCPF + 6, y + 5, w - colunaCPF - 12, rowH - 6, 9.5);
                }
            }
        }
        doc.end();
    });
}
module.exports = { dadosCartao, gerarCartaoPDF, configuracao };
