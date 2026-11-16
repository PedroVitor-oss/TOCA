const express = require('express');
const crypto = require('crypto');
const { db, salvar, novoId, erro, hashSenha, publico, notificarResponsaveis, familiaDe } = require('../lib');
const { autenticar } = require('../auth');
const r = express.Router();

const AVATARES = ['🦊', '🐺', '🐻', '🦝', '🦁', '🐱', '🐼', '🐯'];

function criarSessao(user) {
    const token = crypto.randomBytes(24).toString('hex');
    db.sessoes.push({ token, userId: user.id, criadaEm: new Date().toISOString() });
    return { token, usuario: publico(user) };
}

function validar(body, res, campos) {
    for (const c of campos) {
        if (!body[c] || !String(body[c]).trim()) { erro(res, 400, `Preencha o campo: ${c}.`); return false; }
    }
    if (db.users.some(u => u.email === String(body.email).trim().toLowerCase())) {
        erro(res, 409, 'Esse e-mail já está cadastrado.'); return false;
    }
    if (String(body.senha).length < 6) { erro(res, 400, 'A senha precisa ter pelo menos 6 caracteres.'); return false; }
    return true;
}

function novoUsuario(body, perfil, familiaId) {
    const salt = crypto.randomBytes(8).toString('hex');
    return {
        id: novoId(), perfil, familiaId,
        nome: body.nome.trim(), apelido: (body.apelido || '').trim(),
        email: body.email.trim().toLowerCase(),
        salt, senhaHash: hashSenha(body.senha, salt),
        avatar: body.avatar || (perfil === 'filho' ? AVATARES[0] : '👨'),
        criadoEm: new Date().toISOString()
    };
}

// T02 - cadastro do responsável (cria a família junto)
r.post('/cadastro', (req, res) => {
    if (!validar(req.body, res, ['nome', 'email', 'senha'])) return;
    if (req.body.confirmarSenha !== undefined && req.body.confirmarSenha !== req.body.senha)
        return erro(res, 400, 'As senhas não conferem.');
    const familia = {
        id: novoId(), nome: 'Minha família',
        convite: 'TOCA-' + crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase(),
        mesada: { valor: 0, periodicidade: 'mensal', dia: 5 },
        porcentagens: { guardar: 50, gastar: 30, livre: 20 },
        permissoes: { limiteSemAprovacao: 20, filhoCriaMetas: true, filhoAlteraPrazo: false, rankingAtivo: false },
        privacidade: { saldoParaOutrosResponsaveis: true, conquistasComAmigos: false, dadosParaDicas: true, emailsNovidades: false },
        plano: 'gratuito'
    };
    db.familias.push(familia);
    const user = novoUsuario(req.body, 'responsavel', familia.id);
    db.users.push(user);
    const sessao = criarSessao(user);
    salvar();
    res.status(201).json(sessao);
});

// T07 - cadastro do filho (entra pela família usando o código de convite)
r.post('/cadastro-filho', (req, res) => {
    if (!validar(req.body, res, ['nome', 'email', 'senha', 'codigo'])) return;
    const familia = db.familias.find(f => f.convite === String(req.body.codigo).trim().toUpperCase());
    if (!familia) return erro(res, 404, 'Código de convite inválido.');
    const user = novoUsuario(req.body, 'filho', familia.id);
    db.users.push(user);
    notificarResponsaveis(familia.id, `${user.apelido || user.nome} entrou na família`, 'Convite aceito com sucesso.', 'gerenciar-membros.html');
    const sessao = criarSessao(user);
    salvar();
    res.status(201).json(sessao);
});

// T02 - login
r.post('/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === email);
    if (!user || user.senhaHash !== hashSenha(req.body.senha || '', user.salt))
        return erro(res, 401, 'E-mail ou senha incorretos.');
    const sessao = criarSessao(user);
    salvar();
    res.json(sessao);
});

r.post('/logout', autenticar, (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    db.sessoes = db.sessoes.filter(s => s.token !== token);
    salvar();
    res.json({ ok: true });
});

// T32 / T54 - perfil
r.get('/me', autenticar, (req, res) => res.json(publico(req.user)));

r.put('/me', autenticar, (req, res) => {
    ['nome', 'apelido', 'avatar'].forEach(c => { if (req.body[c] !== undefined) req.user[c] = String(req.body[c]).trim(); });
    salvar();
    res.json(publico(req.user));
});

// T60/T59 - excluir a própria conta (apaga a família se for responsável único)
r.delete('/me', autenticar, (req, res) => {
    const u = req.user;
    db.sessoes = db.sessoes.filter(s => s.userId !== u.id);
    db.users = db.users.filter(x => x.id !== u.id);
    if (!db.users.some(x => x.familiaId === u.familiaId && x.perfil === 'responsavel')) {
        db.users = db.users.filter(x => x.familiaId !== u.familiaId);
        ['familias'].forEach(k => db[k] = db[k].filter(x => x.id !== u.familiaId));
        ['metas', 'lancamentos', 'aprovacoes'].forEach(k => db[k] = db[k].filter(x => x.familiaId !== u.familiaId));
    }
    salvar();
    res.json({ ok: true });
});

module.exports = r;
