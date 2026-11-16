const express = require('express');
const { db, salvar, novoId, num, hoje, erro, familiaDe, metaView, arredonda, notificar, notificarResponsaveis, filhosDaFamilia } = require('../lib');
const { autenticar, so } = require('../auth');
const r = express.Router();
r.use(autenticar);

const minhaMeta = (req, id) => db.metas.find(m => m.id === id && m.familiaId === req.user.familiaId &&
    (req.user.perfil === 'responsavel' || m.filhoId === req.user.id));

// T18/T34 - lista de metas (?status=ativa|concluida|pendente&filhoId=)
r.get('/', (req, res) => {
    const f = familiaDe(req.user);
    let lista = db.metas.filter(m => m.familiaId === f.id);
    if (req.user.perfil === 'filho') lista = lista.filter(m => m.filhoId === req.user.id);
    else if (req.query.filhoId) lista = lista.filter(m => m.filhoId === req.query.filhoId);
    if (req.query.status) lista = lista.filter(m => m.status === req.query.status);
    res.json(lista.map(m => metaView(m, f)));
});

r.get('/:id', (req, res) => {
    const m = minhaMeta(req, req.params.id);
    if (!m) return erro(res, 404, 'Meta não encontrada.');
    const f = familiaDe(req.user);
    const bonus = db.lancamentos.filter(l => l.metaId === m.id && l.categoria === 'Bônus');
    res.json({ ...metaView(m, f), bonus });
});

// T09/T35 - criar meta. Filho: fica pendente até o responsável aprovar. Responsável: já nasce ativa.
r.post('/', (req, res) => {
    const f = familiaDe(req.user);
    const valor = num(req.body.valor);
    const titulo = String(req.body.titulo || '').trim();
    if (!titulo) return erro(res, 400, 'Diga o que você quer comprar.');
    if (!(valor > 0)) return erro(res, 400, 'Informe o valor da meta.');
    let filhoId = req.user.id;
    if (req.user.perfil === 'responsavel') {
        filhoId = req.body.filhoId || (filhosDaFamilia(f.id)[0] || {}).id;
        if (!filhoId) return erro(res, 400, 'Nenhum filho na família ainda.');
    }
    const meta = {
        id: novoId(), familiaId: f.id, filhoId, titulo, icone: req.body.icone || '🎯',
        valor, guardado: 0, prazo: req.body.prazo || null,
        status: req.user.perfil === 'filho' ? 'pendente' : 'ativa', criadaEm: new Date().toISOString()
    };
    db.metas.push(meta);
    if (meta.status === 'pendente') {
        const ap = { id: novoId(), familiaId: f.id, filhoId, tipo: 'meta', refId: meta.id, valor, motivo: '', status: 'pendente', comentario: '', criadaEm: new Date().toISOString() };
        db.aprovacoes.push(ap);
        notificarResponsaveis(f.id, `Nova meta: ${titulo}`, `${req.user.apelido || req.user.nome} quer juntar R$ ${valor.toFixed(2).replace('.', ',')}.`, 'aprovar-meta.html?id=' + ap.id);
    }
    salvar();
    res.status(201).json(metaView(meta, f));
});

// T35 - editar meta (filho: só dele, volta para aprovação se mudar valor)
r.put('/:id', (req, res) => {
    const m = minhaMeta(req, req.params.id);
    if (!m) return erro(res, 404, 'Meta não encontrada.');
    const f = familiaDe(req.user);
    if (req.body.titulo) m.titulo = String(req.body.titulo).trim();
    if (req.body.icone) m.icone = req.body.icone;
    if (req.body.valor !== undefined && num(req.body.valor) > 0) m.valor = num(req.body.valor);
    if (req.body.prazo !== undefined) {
        if (req.user.perfil === 'filho' && !f.permissoes.filhoAlteraPrazo && m.status === 'ativa')
            return erro(res, 403, 'Para mudar o prazo, peça aprovação ao responsável.');
        m.prazo = req.body.prazo;
    }
    salvar();
    res.json(metaView(m, f));
});

// T19 - bônus do responsável
r.post('/:id/bonus', so('responsavel'), (req, res) => {
    const m = minhaMeta(req, req.params.id);
    if (!m || m.status !== 'ativa') return erro(res, 404, 'Meta ativa não encontrada.');
    const valor = num(req.body.valor);
    if (!(valor > 0)) return erro(res, 400, 'Informe o valor do bônus.');
    m.guardado = arredonda(m.guardado + valor);
    db.lancamentos.push({
        id: novoId(), familiaId: m.familiaId, filhoId: m.filhoId, registradoPor: req.user.id,
        tipo: 'economia', valor, categoria: 'Bônus', descricao: `Bônus de ${req.user.nome}`,
        data: hoje(), humor: null, comentario: '', status: 'aprovado', metaId: m.id, criadoEm: new Date().toISOString()
    });
    notificar(m.filhoId, 'Você ganhou um bônus! 🎁', `${req.user.nome} adicionou R$ ${valor.toFixed(2).replace('.', ',')} na meta ${m.titulo}.`, 'minha-meta.html?id=' + m.id);
    salvar();
    res.json(metaView(m, familiaDe(req.user)));
});

// T51 - concluir meta e registrar a compra
r.post('/:id/concluir', so('filho'), (req, res) => {
    const m = minhaMeta(req, req.params.id);
    if (!m || m.status !== 'ativa') return erro(res, 404, 'Meta ativa não encontrada.');
    if (m.guardado < m.valor) return erro(res, 400, `Ainda faltam R$ ${(m.valor - m.guardado).toFixed(2).replace('.', ',')} para concluir.`);
    m.status = 'concluida';
    m.concluidaEm = new Date().toISOString();
    m.compra = { valorPago: num(req.body.valorPago) || m.valor, local: req.body.local || '', data: req.body.data || hoje() };
    notificarResponsaveis(m.familiaId, `${req.user.apelido || req.user.nome} bateu a meta! 🏆`, m.titulo, 'metas-filho.html');
    salvar();
    // T52 - sugestões de próxima meta
    const sugestoes = [
        { titulo: 'Jogo novo', icone: '🎮', valor: 250 },
        { titulo: 'Capacete e acessórios', icone: '🚲', valor: 180 },
        { titulo: 'Reserva de emergência', icone: '🐷', valor: 300 }
    ];
    res.json({ meta: metaView(m, familiaDe(req.user)), sugestoes });
});

module.exports = r;
