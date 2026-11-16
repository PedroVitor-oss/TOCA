const express = require('express');
const { db, salvar, novoId, num, erro, familiaDe, impactoDias, metaView, notificar, notificarResponsaveis } = require('../lib');
const { autenticar, so } = require('../auth');
const r = express.Router();
r.use(autenticar);

// Junta os dados do pedido (gasto, meta ou prazo) para as telas T15/T16/T10
function detalhar(a) {
    const filho = db.users.find(u => u.id === a.filhoId);
    const f = db.familias.find(x => x.id === a.familiaId);
    const base = { ...a, filhoNome: filho ? (filho.apelido || filho.nome) : '', filhoAvatar: filho ? filho.avatar : '🦊' };
    if (a.tipo === 'gasto') {
        const l = db.lancamentos.find(x => x.id === a.refId);
        return { ...base, lancamento: l || null, impactoDias: impactoDias(f, a.valor) };
    }
    const m = db.metas.find(x => x.id === a.refId);
    return { ...base, meta: m ? metaView(m, f) : null };
}
const visivel = (req, a) => a.familiaId === req.user.familiaId && (req.user.perfil === 'responsavel' || a.filhoId === req.user.id);

// T15 - fila (?status=pendente|aprovado|recusado)
r.get('/', (req, res) => {
    let lista = db.aprovacoes.filter(a => visivel(req, a));
    if (req.query.status === 'historico') lista = lista.filter(a => a.status !== 'pendente');
    else if (req.query.status) lista = lista.filter(a => a.status === req.query.status);
    lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
    res.json(lista.map(detalhar));
});

r.get('/:id', (req, res) => {
    const a = db.aprovacoes.find(x => x.id === req.params.id);
    if (!a || !visivel(req, a)) return erro(res, 404, 'Pedido não encontrado.');
    res.json(detalhar(a));
});

// T42 - filho pede mudança de prazo de uma meta
r.post('/', so('filho'), (req, res) => {
    const m = db.metas.find(x => x.id === req.body.metaId && x.filhoId === req.user.id && x.status === 'ativa');
    if (!m) return erro(res, 404, 'Meta não encontrada.');
    if (!req.body.novoPrazo) return erro(res, 400, 'Informe o novo prazo.');
    const a = { id: novoId(), familiaId: m.familiaId, filhoId: req.user.id, tipo: 'prazo', refId: m.id, valor: 0, novoPrazo: req.body.novoPrazo, motivo: req.body.motivo || '', status: 'pendente', comentario: '', criadaEm: new Date().toISOString() };
    db.aprovacoes.push(a);
    notificarResponsaveis(m.familiaId, 'Pedido para mudar o prazo', `${req.user.apelido || req.user.nome} quer mudar o prazo de ${m.titulo}.`, 'detalhe-aprovacao.html?id=' + a.id);
    salvar();
    res.status(201).json(detalhar(a));
});

// T42 - filho explica o motivo do gasto
r.put('/:id', so('filho'), (req, res) => {
    const a = db.aprovacoes.find(x => x.id === req.params.id && x.filhoId === req.user.id && x.status === 'pendente');
    if (!a) return erro(res, 404, 'Pedido não encontrado.');
    a.motivo = String(req.body.motivo || '').trim();
    notificarResponsaveis(a.familiaId, 'O pedido ganhou uma explicação', a.motivo, 'detalhe-aprovacao.html?id=' + a.id);
    salvar();
    res.json(detalhar(a));
});

// T10/T16 - aprovar ou recusar com um toque
r.post('/:id/decidir', so('responsavel'), (req, res) => {
    const a = db.aprovacoes.find(x => x.id === req.params.id && x.familiaId === req.user.familiaId);
    if (!a) return erro(res, 404, 'Pedido não encontrado.');
    if (a.status !== 'pendente') return erro(res, 409, 'Esse pedido já foi respondido.');
    const aprovar = req.body.aprovar === true || req.body.aprovar === 'true';
    a.status = aprovar ? 'aprovado' : 'recusado';
    a.comentario = String(req.body.comentario || '');
    a.decididaEm = new Date().toISOString();

    let titulo;
    if (a.tipo === 'gasto') {
        const l = db.lancamentos.find(x => x.id === a.refId);
        if (l) l.status = aprovar ? 'aprovado' : 'recusado';
        titulo = `Gasto de R$ ${a.valor.toFixed(2).replace('.', ',')} ${aprovar ? 'aprovado' : 'recusado'}`;
    } else if (a.tipo === 'meta') {
        const m = db.metas.find(x => x.id === a.refId);
        if (m) {
            m.status = aprovar ? 'ativa' : 'recusada';
            if (aprovar && num(req.body.valorAjustado) > 0) m.valor = num(req.body.valorAjustado);
        }
        titulo = `Meta ${aprovar ? 'aprovada 🎉' : 'recusada'}`;
    } else {
        const m = db.metas.find(x => x.id === a.refId);
        if (m && aprovar) m.prazo = a.novoPrazo;
        titulo = `Pedido de prazo ${aprovar ? 'aprovado' : 'recusado'}`;
    }
    notificar(a.filhoId, titulo, a.comentario, a.tipo === 'meta' ? 'minha-meta.html?id=' + a.refId : 'meu-extrato.html');
    salvar();
    res.json(detalhar(a));
});

module.exports = r;
