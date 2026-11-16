// Dashboard, notificações, check-in, missões, conquistas, ranking, relatório, conteúdo e exportação
const express = require('express');
const { db, salvar, novoId, num, hoje, dataLocal, erro, familiaDe, filhosDaFamilia, saldoFilho, metaView, arredonda, streak } = require('../lib');
const { autenticar, so } = require('../auth');
const r = express.Router();
r.use(autenticar);

const nomeFilho = u => u.apelido || u.nome;
const gastosAprovados = (filtro) => db.lancamentos.filter(l => l.tipo === 'gasto' && l.status === 'aprovado' && filtro(l));
const soma = lista => arredonda(lista.reduce((s, l) => s + l.valor, 0));
const inicioSemana = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dataLocal(d); }; // segunda-feira

// ---------------- T11 / T33 - home ----------------
r.get('/dashboard', (req, res) => {
    const u = req.user, f = familiaDe(u);
    const naoLidas = db.notificacoes.filter(n => n.userId === u.id && !n.lida)
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));

    if (u.perfil === 'responsavel') {
        const mes = hoje().slice(0, 7);
        const filhos = filhosDaFamilia(f.id);
        return res.json({
            perfil: 'responsavel', nome: u.nome, familia: f.nome,
            saldo: arredonda(filhos.reduce((s, x) => s + saldoFilho(x.id), 0)),
            gastoMes: soma(gastosAprovados(l => l.familiaId === f.id && l.data.startsWith(mes))),
            pendentes: db.aprovacoes.filter(a => a.familiaId === f.id && a.status === 'pendente').length,
            filhos: filhos.map(x => ({ id: x.id, nome: nomeFilho(x), avatar: x.avatar, streak: streak(x.id) })),
            notificacoes: naoLidas.slice(0, 3)
        });
    }

    const meta = db.metas.filter(m => m.filhoId === u.id && m.status === 'ativa')
        .sort((a, b) => b.guardado / b.valor - a.guardado / a.valor)[0];
    const semana = soma(gastosAprovados(l => l.filhoId === u.id && l.data >= inicioSemana()));
    res.json({
        perfil: 'filho', nome: nomeFilho(u), avatar: u.avatar,
        meta: meta ? metaView(meta, f) : null,
        saldo: saldoFilho(u.id), semana,
        streak: streak(u.id),
        checkinHoje: db.checkins.some(c => c.userId === u.id && c.data === hoje()),
        notificacoesNaoLidas: naoLidas.length
    });
});

// ---------------- T55 / T56 - notificações ----------------
r.get('/notificacoes', (req, res) => {
    const lista = db.notificacoes.filter(n => n.userId === req.user.id)
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
    res.json(lista);
});
r.post('/notificacoes/lidas', (req, res) => {
    db.notificacoes.filter(n => n.userId === req.user.id).forEach(n => n.lida = true);
    salvar();
    res.json({ ok: true });
});
r.post('/notificacoes/:id/lida', (req, res) => {
    const n = db.notificacoes.find(x => x.id === req.params.id && x.userId === req.user.id);
    if (!n) return erro(res, 404, 'Notificação não encontrada.');
    n.lida = true;
    salvar();
    res.json(n);
});
// preferências de notificação ficam no próprio usuário
r.get('/notificacoes-config', (req, res) => res.json(req.user.notificacoes || { checkin: true, aprovacoes: true, metas: true, resumo: true, dica: false }));
r.put('/notificacoes-config', (req, res) => {
    req.user.notificacoes = { ...(req.user.notificacoes || {}), ...req.body };
    salvar();
    res.json(req.user.notificacoes);
});

// ---------------- T44 - check-in diário ----------------
r.post('/checkin', so('filho'), (req, res) => {
    const dados = { saldo: num(req.body.saldo), humor: req.body.humor || '🙂' };
    const existente = db.checkins.find(c => c.userId === req.user.id && c.data === hoje());
    if (existente) Object.assign(existente, dados);
    else db.checkins.push({ id: novoId(), userId: req.user.id, data: hoje(), ...dados });
    salvar();
    res.status(201).json({ ok: true, streak: streak(req.user.id) });
});

// ---------------- T45 / T46 - missões da semana ----------------
function missoes(u) {
    const ini = inicioSemana();
    const gastos = db.lancamentos.filter(l => l.filhoId === u.id && l.tipo === 'gasto' && l.data >= ini).length;
    const checkins = db.checkins.filter(c => c.userId === u.id && c.data >= ini).length;
    const guardou = db.lancamentos.filter(l => l.filhoId === u.id && l.tipo === 'economia' && l.data >= ini && l.valor >= 10).length;
    const m = (id, icone, titulo, atual, meta, bolotas) => ({ id, icone, titulo, atual: Math.min(atual, meta), meta, bolotas, concluida: atual >= meta });
    return [
        m('gastos', '📝', 'Registre 3 gastos', gastos, 3, 20),
        m('checkin', '🔥', 'Faça check-in 5 dias', checkins, 5, 30),
        m('guardar', '🐷', 'Guarde R$ 10 na meta', guardou, 1, 40)
    ];
}
r.get('/missoes', so('filho'), (req, res) => res.json(missoes(req.user)));

// ---------------- T47 - conquistas ----------------
r.get('/conquistas', so('filho'), (req, res) => {
    const u = req.user;
    const metas = db.metas.filter(m => m.filhoId === u.id);
    const lancs = db.lancamentos.filter(l => l.filhoId === u.id);
    const guardadoTotal = lancs.filter(l => l.tipo === 'economia').reduce((s, l) => s + l.valor, 0);
    const s = streak(u.id);
    const selos = [
        { id: 'primeira', icone: '🌱', nome: 'Primeira meta', desbloqueada: metas.some(m => m.status === 'ativa' || m.status === 'concluida') },
        { id: 'streak7', icone: '🔥', nome: '7 dias', desbloqueada: s >= 7 },
        { id: 'anotador', icone: '📝', nome: 'Anotador', desbloqueada: lancs.filter(l => l.tipo === 'gasto').length >= 3 },
        { id: 'streak30', icone: '🏅', nome: '30 dias', desbloqueada: s >= 30 },
        { id: 'batida', icone: '🏆', nome: 'Meta batida', desbloqueada: metas.some(m => m.status === 'concluida') },
        { id: 'poupador', icone: '🐷', nome: 'Poupador', desbloqueada: guardadoTotal >= 500 }
    ];
    res.json({ selos, streak: s, historico: metas.filter(m => m.status === 'concluida').map(m => ({ titulo: m.titulo, icone: m.icone, valor: m.valor, data: m.concluidaEm })) });
});

// ---------------- T48 - ranking de consistência (opt-in; nunca mostra valores) ----------------
r.get('/ranking', (req, res) => {
    const f = familiaDe(req.user);
    if (!f.permissoes.rankingAtivo) return res.json({ ativo: false, itens: [] });
    const itens = filhosDaFamilia(f.id).map(x => ({ nome: nomeFilho(x), avatar: x.avatar, sequencia: streak(x.id), voce: x.id === req.user.id }))
        .sort((a, b) => b.sequencia - a.sequencia);
    res.json({ ativo: true, itens });
});

// ---------------- T20 - relatório mensal ----------------
r.get('/relatorio', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    const mes = req.query.mes || hoje().slice(0, 7);
    const filho = req.query.filhoId ? db.users.find(u => u.id === req.query.filhoId) : filhosDaFamilia(f.id)[0];
    const doMes = db.lancamentos.filter(l => l.familiaId === f.id && l.data.startsWith(mes) && (!filho || l.filhoId === filho.id));
    const gastos = doMes.filter(l => l.tipo === 'gasto' && l.status === 'aprovado');
    const semanas = [0, 0, 0, 0];
    gastos.forEach(l => { semanas[Math.min(3, Math.floor((parseInt(l.data.slice(8), 10) - 1) / 7))] += l.valor; });
    const humores = { feliz: 0, normal: 0, arrependido: 0 };
    gastos.forEach(l => { if (humores[l.humor] !== undefined) humores[l.humor]++; });
    const comHumor = humores.feliz + humores.normal + humores.arrependido;
    const pct = n => comHumor ? Math.round(n / comHumor * 100) : 0;
    res.json({
        mes, filho: filho ? nomeFilho(filho) : null,
        guardado: soma(doMes.filter(l => l.tipo === 'economia')),
        gasto: soma(gastos),
        semanas: semanas.map(arredonda),
        emocional: { feliz: pct(humores.feliz), normal: pct(humores.normal), arrependido: pct(humores.arrependido) }
    });
});

// ---------------- T22 / T23 / T24 / T43 - conteúdo ----------------
r.get('/dicas', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    const dicas = [];
    const porCat = {};
    gastosAprovados(l => l.familiaId === f.id && l.filhoId).forEach(l => porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor);
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
    if (top) dicas.push({ icone: '🍕', titulo: `${top[0]} é o que mais pesa`, texto: `Esse é o maior gasto dos seus filhos. Que tal combinar um limite semanal?` });
    const maiorStreak = Math.max(0, ...filhosDaFamilia(f.id).map(x => streak(x.id)));
    if (maiorStreak >= 3) dicas.push({ icone: '🎉', titulo: 'Reforce o positivo', texto: `Tem filho há ${maiorStreak} dias seguidos fazendo check-in. Elogiar aumenta a motivação.` });
    dicas.push({ icone: '🎯', titulo: 'Conversa rápida', texto: 'Pergunte: "O que você faria se a meta atrasasse 1 mês?"' });
    res.json(dicas);
});

const BIBLIOTECA = [
    { id: 1, icone: '📖', titulo: 'Como definir uma mesada justa', tipo: 'Artigo', minutos: 4, categoria: 'Mesada' },
    { id: 2, icone: '🎥', titulo: 'Ensinando a poupar com metas', tipo: 'Vídeo', minutos: 6, categoria: 'Metas' },
    { id: 3, icone: '💬', titulo: 'Como conversar sobre dinheiro', tipo: 'Artigo', minutos: 5, categoria: 'Conversas' },
    { id: 4, icone: '🛍️', titulo: 'Querer x precisar', tipo: 'Artigo', minutos: 3, categoria: 'Conversas' }
];
r.get('/biblioteca', (req, res) => res.json(BIBLIOTECA));
r.get('/biblioteca/:id', (req, res) => {
    const c = BIBLIOTECA.find(x => x.id === parseInt(req.params.id, 10));
    return c ? res.json(c) : erro(res, 404, 'Conteúdo não encontrado.');
});

const DICAS_DIA = [
    'Antes de comprar, pergunte: "Eu vou usar isso daqui a um mês?"',
    'Esperar 24 horas ajuda a saber se você quer ou precisa mesmo.',
    'Guardar um pouquinho todo dia vale mais que muito de vez em quando.',
    'Compare preços em pelo menos duas lojas antes de comprar.'
];
r.get('/dica-do-dia', (req, res) => {
    const dia = Math.floor(Date.now() / 86400000);
    res.json({ texto: DICAS_DIA[dia % DICAS_DIA.length] });
});

// ---------------- T31 - exportar dados (?formato=csv|json) ----------------
r.get('/exportar', so('responsavel'), (req, res) => {
    const f = familiaDe(req.user);
    const itens = db.lancamentos.filter(l => l.familiaId === f.id).sort((a, b) => a.data.localeCompare(b.data));
    if (req.query.formato === 'json') {
        res.setHeader('Content-Disposition', 'attachment; filename="toca-dados.json"');
        return res.json({ familia: f.nome, lancamentos: itens, metas: db.metas.filter(m => m.familiaId === f.id) });
    }
    const linhas = ['data;tipo;categoria;descricao;valor;status;filho'];
    itens.forEach(l => {
        const filho = db.users.find(u => u.id === l.filhoId);
        linhas.push([l.data, l.tipo, l.categoria, `"${(l.descricao || '').replace(/"/g, '""')}"`, l.valor.toFixed(2).replace('.', ','), l.status, filho ? nomeFilho(filho) : 'Família'].join(';'));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="toca-extrato.csv"');
    res.send('\uFEFF' + linhas.join('\n'));
});

module.exports = r;
