const express = require('express');
const { db, salvar, novoId, num, hoje, erro, familiaDe, impactoDias, arredonda, notificar, notificarResponsaveis, filhosDaFamilia } = require('../lib');
const { autenticar } = require('../auth');
const r = express.Router();
r.use(autenticar);

const enriquecer = l => {
    const filho = l.filhoId && db.users.find(u => u.id === l.filhoId);
    return { ...l, filhoNome: filho ? (filho.apelido || filho.nome) : null };
};
const doUsuario = (req, id) => db.lancamentos.find(l => l.id === id && l.familiaId === req.user.familiaId &&
    (req.user.perfil === 'responsavel' || l.filhoId === req.user.id));

// T12/T40 - extrato (?tipo=gasto|economia|entrada&filhoId=&mes=2024-02)
r.get('/', (req, res) => {
    let lista = db.lancamentos.filter(l => l.familiaId === req.user.familiaId);
    if (req.user.perfil === 'filho') lista = lista.filter(l => l.filhoId === req.user.id);
    else if (req.query.filhoId === 'familia') lista = lista.filter(l => !l.filhoId);
    else if (req.query.filhoId) lista = lista.filter(l => l.filhoId === req.query.filhoId);
    if (req.query.tipo) lista = lista.filter(l => l.tipo === req.query.tipo);
    if (req.query.mes) lista = lista.filter(l => l.data.startsWith(req.query.mes));
    lista.sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
    const gastos = lista.filter(l => l.tipo === 'gasto' && l.status === 'aprovado').reduce((s, l) => s + l.valor, 0);
    const entradas = lista.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    res.json({ itens: lista.map(enriquecer), totais: { entradas: arredonda(entradas), saidas: arredonda(gastos) } });
});

// Pré-visualização do aviso "isso atrasa sua meta em X dias" (T36)
r.get('/impacto', (req, res) => {
    const valor = num(req.query.valor);
    res.json({ dias: valor > 0 ? impactoDias(familiaDe(req.user), valor) : 0 });
});

r.get('/:id', (req, res) => {
    const l = doUsuario(req, req.params.id);
    if (!l) return erro(res, 404, 'Lançamento não encontrado.');
    res.json(enriquecer(l));
});

// T14/T36/T37 - registrar gasto, economia ou entrada
r.post('/', (req, res) => {
    const u = req.user, f = familiaDe(u);
    const tipo = req.body.tipo || 'gasto';
    if (!['gasto', 'economia', 'entrada'].includes(tipo)) return erro(res, 400, 'Tipo inválido.');
    const valor = num(req.body.valor);
    if (!(valor > 0)) return erro(res, 400, 'Informe um valor maior que zero.');

    let filhoId = u.perfil === 'filho' ? u.id : (req.body.filhoId || null);
    if (filhoId && !filhosDaFamilia(f.id).some(x => x.id === filhoId)) return erro(res, 400, 'Filho inválido.');
    if (tipo === 'economia' && !filhoId) return erro(res, 400, 'Escolha o filho que vai guardar.');

    const l = {
        id: novoId(), familiaId: f.id, filhoId, registradoPor: u.id, tipo, valor,
        categoria: req.body.categoria || 'Outros', descricao: String(req.body.descricao || '').trim(),
        data: req.body.data || hoje(), humor: req.body.humor || null, comentario: '',
        status: 'aprovado', metaId: null, criadoEm: new Date().toISOString()
    };

    if (tipo === 'economia') {
        const meta = req.body.metaId
            ? db.metas.find(m => m.id === req.body.metaId && m.filhoId === filhoId && m.status === 'ativa')
            : db.metas.find(m => m.filhoId === filhoId && m.status === 'ativa');
        if (!meta) return erro(res, 400, 'Crie uma meta ativa antes de guardar dinheiro.');
        meta.guardado = arredonda(meta.guardado + valor);
        l.metaId = meta.id;
        if (!l.descricao) l.descricao = `Guardado em ${meta.titulo}`;
        if (meta.guardado >= meta.valor) notificar(filhoId, 'Meta completa! 🎉', `Você juntou tudo para ${meta.titulo}. Conclua a compra!`, 'concluir-meta.html?id=' + meta.id);
    }

    let aprovacaoId = null;
    if (tipo === 'gasto' && u.perfil === 'filho' && valor > f.permissoes.limiteSemAprovacao) {
        l.status = 'pendente';
        const ap = { id: novoId(), familiaId: f.id, filhoId, tipo: 'gasto', refId: l.id, valor, motivo: '', status: 'pendente', comentario: '', criadaEm: new Date().toISOString() };
        db.aprovacoes.push(ap);
        aprovacaoId = ap.id;
        notificarResponsaveis(f.id, `Confirmar gasto de R$ ${valor.toFixed(2).replace('.', ',')}`, `${u.apelido || u.nome} pediu aprovação.`, 'detalhe-aprovacao.html?id=' + ap.id);
    }

    db.lancamentos.push(l);
    salvar();
    res.status(201).json({
        lancamento: enriquecer(l),
        precisaAprovacao: !!aprovacaoId, aprovacaoId,
        impactoDias: tipo === 'gasto' ? impactoDias(f, valor) : 0
    });
});

// T13 - comentário do responsável / edição do dono
r.put('/:id', (req, res) => {
    const l = doUsuario(req, req.params.id);
    if (!l) return erro(res, 404, 'Lançamento não encontrado.');
    if (req.body.comentario !== undefined && req.user.perfil === 'responsavel') {
        l.comentario = String(req.body.comentario);
        if (l.filhoId) notificar(l.filhoId, 'Recado do responsável 💬', l.comentario, 'detalhe-lancamento.html?id=' + l.id);
    }
    ['descricao', 'categoria', 'humor'].forEach(c => { if (req.body[c] !== undefined) l[c] = req.body[c]; });
    salvar();
    res.json(enriquecer(l));
});

// T13/T41 - excluir (devolve o dinheiro à meta se era economia)
r.delete('/:id', (req, res) => {
    const l = doUsuario(req, req.params.id);
    if (!l) return erro(res, 404, 'Lançamento não encontrado.');
    if (l.tipo === 'economia' && l.metaId) {
        const m = db.metas.find(x => x.id === l.metaId);
        if (m) m.guardado = Math.max(0, arredonda(m.guardado - l.valor));
    }
    db.lancamentos = db.lancamentos.filter(x => x.id !== l.id);
    db.aprovacoes = db.aprovacoes.filter(a => !(a.tipo === 'gasto' && a.refId === l.id));
    salvar();
    res.json({ ok: true });
});

module.exports = r;
