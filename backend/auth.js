// Autenticação por token (Authorization: Bearer <token>)
const { db, erro } = require('./lib');

function autenticar(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const sessao = db.sessoes.find(s => s.token === token);
    const user = sessao && db.users.find(u => u.id === sessao.userId);
    if (!user) return erro(res, 401, 'Faça login para continuar.');
    req.user = user;
    next();
}

// Restringe a rota a um perfil: so('responsavel') ou so('filho')
const so = perfil => (req, res, next) =>
    req.user.perfil === perfil ? next() : erro(res, 403, 'Esta ação não está disponível para o seu perfil.');

module.exports = { autenticar, so };
