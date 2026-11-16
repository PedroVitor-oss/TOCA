// Cria dados de exemplo iguais aos das telas: node seed.js
// Logins: joao@mail.com / 123456 (responsável)  e  john@mail.com / 123456 (filho)
const fs = require('fs');
const path = require('path');
const arq = path.join(__dirname, 'data', 'db.json');
if (fs.existsSync(arq)) fs.unlinkSync(arq);

const { db, salvar, novoId } = require('./db');
const { hashSenha, dataLocal } = require('./lib');

const mk = (nome, email, perfil, avatar, familiaId, apelido) => {
    const salt = 'seed';
    const u = { id: novoId(), perfil, familiaId, nome, apelido: apelido || '', email, salt, senhaHash: hashSenha('123456', salt), avatar, criadoEm: new Date().toISOString() };
    db.users.push(u);
    return u;
};
const dia = n => { const d = new Date(); d.setDate(d.getDate() - n); return dataLocal(d); };

const familia = {
    id: novoId(), nome: 'Família Silva', convite: 'TOCA-7K2P9',
    mesada: { valor: 150, periodicidade: 'mensal', dia: 5 },
    porcentagens: { guardar: 50, gastar: 30, livre: 20 },
    permissoes: { limiteSemAprovacao: 20, filhoCriaMetas: true, filhoAlteraPrazo: false, rankingAtivo: true },
    privacidade: { saldoParaOutrosResponsaveis: true, conquistasComAmigos: false, dadosParaDicas: true, emailsNovidades: false },
    plano: 'gratuito'
};
db.familias.push(familia);
const joao = mk('João Silva', 'joao@mail.com', 'responsavel', '👨', familia.id);
const john = mk('John', 'john@mail.com', 'filho', '🦊', familia.id, 'John');

const meta = { id: novoId(), familiaId: familia.id, filhoId: john.id, titulo: 'Fone de ouvido', icone: '🎧', valor: 900, guardado: 420, prazo: dia(-300), status: 'ativa', criadaEm: new Date().toISOString() };
db.metas.push(meta);

const L = (tipo, valor, categoria, descricao, d, extra) => db.lancamentos.push({
    id: novoId(), familiaId: familia.id, filhoId: john.id, registradoPor: john.id, tipo, valor, categoria, descricao,
    data: dia(d), humor: null, comentario: '', status: 'aprovado', metaId: null, criadoEm: new Date().toISOString(), ...extra
});
L('entrada', 570, 'Mesada', 'Mesadas e presentes', 20);
L('economia', 420, 'Mesada', 'Guardado no fone', 19, { metaId: meta.id });
L('gasto', 8, 'Bebida', 'Refrigerante', 5, { humor: 'normal' });
L('gasto', 35, 'Alimento', 'Pizza com amigos', 2, { humor: 'feliz' });
db.lancamentos.push({ id: novoId(), familiaId: familia.id, filhoId: null, registradoPor: joao.id, tipo: 'gasto', valor: 120, categoria: 'Mercado', descricao: 'Mercado', data: dia(3), humor: null, comentario: '', status: 'aprovado', metaId: null, criadoEm: new Date().toISOString() });

for (let i = 0; i < 12; i++) db.checkins.push({ id: novoId(), userId: john.id, data: dia(i), saldo: 100, humor: '🙂' });

db.notificacoes.push({ id: novoId(), userId: joao.id, titulo: 'Economia da semana guardada!', texto: 'John guardou R$ 75,00', link: 'metas-filho.html', lida: false, criadaEm: new Date().toISOString() });

salvar();
console.log('Dados de exemplo criados.');
