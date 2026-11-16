const express = require('express');
const { db, salvar, novoId, num, hoje, erro, publico, familiaDe, filhosDaFamilia, saldoFilho, arredonda, notificar } = require('../lib');
const { autenticar, so } = require('../auth');
const r = express.Router();
r.use(autenticar);

// T03/T53 - dados da família (o convite só aparece para o responsável)
r.get('/', (req, res) => {
    const f = { ...familiaDe(req.user) };
    if (req.user.perfil !== 'responsavel') { delete f.convite; delete f.privacidade; }
    res.json(f);
});

// T03 - nome da família
r.put('/', so('responsavel'), (req, res) => {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return erro(res, 400, 'Informe o nome da família.');
    familiaDe(req.user).nome = nome;
    salvar();
    res.json(familiaDe(req.user));
});

// T04/T29 - mesada
r.put('/mesada', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    const valor = num(req.body.valor);
    if (valor < 0) return erro(res, 400, 'Valor inválido.');
    const periodicidade = String(req.body.periodicidade || f.mesada.periodicidade).toLowerCase();
    if (!['semanal', 'quinzenal', 'mensal'].includes(periodicidade)) return erro(res, 400, 'Periodicidade inválida.');
    f.mesada = { valor, periodicidade, dia: parseInt(req.body.dia, 10) || f.mesada.dia };
    salvar();
    res.json(f.mesada);
});

// T05/T27 - porcentagens (soma = 100)
r.put('/porcentagens', so('responsavel'), (req, res) => {
    const g = num(req.body.guardar), s = num(req.body.gastar), l = num(req.body.livre);
    if (g < 0 || s < 0 || l < 0) return erro(res, 400, 'Porcentagens inválidas.');
    if (Math.round(g + s + l) !== 100) return erro(res, 400, 'A soma das porcentagens precisa ser 100%.');
    const f = familiaDe(req.user);
    f.porcentagens = { guardar: g, gastar: s, livre: l };
    salvar();
    res.json(f.porcentagens);
});

// T26 - permissões do filho
r.put('/permissoes', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    const p = f.permissoes;
    if (req.body.limiteSemAprovacao !== undefined) p.limiteSemAprovacao = num(req.body.limiteSemAprovacao);
    ['filhoCriaMetas', 'filhoAlteraPrazo', 'rankingAtivo'].forEach(c => { if (req.body[c] !== undefined) p[c] = !!req.body[c]; });
    salvar();
    res.json(p);
});

// T28 - privacidade
r.put('/privacidade', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    Object.keys(f.privacidade).forEach(c => { if (req.body[c] !== undefined) f.privacidade[c] = !!req.body[c]; });
    salvar();
    res.json(f.privacidade);
});

// T25 - membros
r.get('/membros', (req, res) => {
    const membros = db.users.filter(u => u.familiaId === req.user.familiaId).map(publico);
    res.json(membros);
});

r.delete('/membros/:id', so('responsavel'), (req, res) => {
    const alvo = db.users.find(u => u.id === req.params.id && u.familiaId === req.user.familiaId);
    if (!alvo) return erro(res, 404, 'Membro não encontrado.');
    if (alvo.id === req.user.id) return erro(res, 400, 'Você não pode remover a si mesmo.');
    db.users = db.users.filter(u => u.id !== alvo.id);
    db.sessoes = db.sessoes.filter(s => s.userId !== alvo.id);
    salvar();
    res.json({ ok: true });
});

// T30 - assinatura (simulada: só troca o plano)
r.put('/plano', so('responsavel'), (req, res) => {
    const plano = req.body.plano === 'premium' ? 'premium' : 'gratuito';
    familiaDe(req.user).plano = plano;
    salvar();
    res.json({ plano });
});

// Paga a mesada agora: parte "guardar" vai para a meta ativa, o resto vira saldo
r.post('/mesada/pagar', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    if (!(f.mesada.valor > 0)) return erro(res, 400, 'Configure o valor da mesada primeiro.');
    const resultado = [];
    filhosDaFamilia(f.id).forEach(filho => {
        const guardar = arredonda(f.mesada.valor * f.porcentagens.guardar / 100);
        const resto = arredonda(f.mesada.valor - guardar);
        const meta = db.metas.find(m => m.filhoId === filho.id && m.status === 'ativa');
        const base = { id: '', familiaId: f.id, filhoId: filho.id, registradoPor: req.user.id, categoria: 'Mesada', descricao: 'Mesada', data: hoje(), humor: null, comentario: '', status: 'aprovado', criadoEm: new Date().toISOString() };
        if (meta && guardar > 0) {
            meta.guardado = arredonda(meta.guardado + guardar);
            db.lancamentos.push({ ...base, id: novoId(), tipo: 'entrada', valor: f.mesada.valor, metaId: null });
            db.lancamentos.push({ ...base, id: novoId(), tipo: 'economia', valor: guardar, descricao: 'Mesada guardada na meta', metaId: meta.id });
        } else {
            db.lancamentos.push({ ...base, id: novoId(), tipo: 'entrada', valor: f.mesada.valor, metaId: null });
        }
        notificar(filho.id, 'Mesada recebida! 💰', `R$ ${f.mesada.valor.toFixed(2).replace('.', ',')} caíram na sua conta.`, 'meu-extrato.html');
        resultado.push({ filho: filho.nome, guardado: meta ? guardar : 0, saldo: saldoFilho(filho.id) });
    });
    salvar();
    res.json({ ok: true, resultado });
});

module.exports = r;
