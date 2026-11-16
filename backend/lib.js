// Funções de apoio usadas por várias rotas.
const crypto = require('crypto');
const { db, salvar, novoId } = require('./db');

const arredonda = n => Math.round(n * 100) / 100;

// Aceita 35, "35.5", "35,50" ou "1.200,50"
function num(v) {
    if (typeof v === 'number') return v;
    let s = String(v === undefined || v === null ? '' : v).trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

const dataLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoje = () => dataLocal(new Date());

function erro(res, status, mensagem) {
    return res.status(status).json({ erro: mensagem });
}

// ---------- senha ----------
function hashSenha(senha, salt) {
    return crypto.scryptSync(String(senha), salt, 32).toString('hex');
}

function publico(u) {
    const { senhaHash, salt, ...resto } = u;
    return resto;
}

// ---------- família ----------
const familiaDe = u => db.familias.find(f => f.id === u.familiaId);
const filhosDaFamilia = familiaId => db.users.filter(u => u.familiaId === familiaId && u.perfil === 'filho');
const responsaveisDaFamilia = familiaId => db.users.filter(u => u.familiaId === familiaId && u.perfil === 'responsavel');

// Saldo disponível do filho = entradas - gastos aprovados - dinheiro guardado em metas
function saldoFilho(filhoId) {
    let s = 0;
    db.lancamentos.filter(l => l.filhoId === filhoId).forEach(l => {
        if (l.tipo === 'entrada') s += l.valor;
        if (l.tipo === 'gasto' && l.status === 'aprovado') s -= l.valor;
        if (l.tipo === 'economia') s -= l.valor;
    });
    return arredonda(s);
}

// Quantos dias um gasto atrasa a meta (com base no quanto o filho guarda por dia)
function impactoDias(familia, valor) {
    const guardarMes = familia.mesada.valor * familia.porcentagens.guardar / 100;
    if (guardarMes <= 0) return 0;
    return Math.ceil(valor / (guardarMes / 30));
}

function metaView(m, familia) {
    const faltam = Math.max(0, arredonda(m.valor - m.guardado));
    const mensal = familia.mesada.valor * familia.porcentagens.guardar / 100;
    let previsao = null;
    if (faltam === 0) previsao = dataLocal(new Date()).slice(0, 7);
    else if (mensal > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + Math.ceil(faltam / mensal));
        previsao = dataLocal(d).slice(0, 7);
    }
    return {
        ...m, faltam,
        pct: m.valor > 0 ? Math.min(100, Math.round(m.guardado / m.valor * 100)) : 0,
        previsao,
        noPrazo: !!(previsao && (!m.prazo || previsao <= m.prazo.slice(0, 7)))
    };
}

// ---------- notificações ----------
function notificar(userId, titulo, texto, link) {
    db.notificacoes.push({ id: novoId(), userId, titulo, texto: texto || '', link: link || '', lida: false, criadaEm: new Date().toISOString() });
}
function notificarResponsaveis(familiaId, titulo, texto, link) {
    responsaveisDaFamilia(familiaId).forEach(r => notificar(r.id, titulo, texto, link));
}

// ---------- sequência (streak) de check-ins ----------
function streak(userId) {
    const dias = new Set(db.checkins.filter(c => c.userId === userId).map(c => c.data));
    let d = new Date();
    if (!dias.has(dataLocal(d))) d.setDate(d.getDate() - 1); // ainda dá tempo de fazer hoje
    let n = 0;
    while (dias.has(dataLocal(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
}

module.exports = {
    db, salvar, novoId, arredonda, num, hoje, dataLocal, erro, hashSenha, publico,
    familiaDe, filhosDaFamilia, responsaveisDaFamilia, saldoFilho, impactoDias, metaView,
    notificar, notificarResponsaveis, streak
};
