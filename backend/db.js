// "Banco de dados" simples: um arquivo JSON carregado em memória.
// Toda rota que altera algo chama salvar() no final.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARQUIVO = path.join(__dirname, 'data', 'db.json');
const VAZIO = {
    users: [], familias: [], metas: [], lancamentos: [],
    aprovacoes: [], notificacoes: [], checkins: [], sessoes: []
};

fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
const db = Object.assign({}, VAZIO,
    fs.existsSync(ARQUIVO) ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) : {});

function salvar() {
    fs.writeFileSync(ARQUIVO + '.tmp', JSON.stringify(db, null, 2));
    fs.renameSync(ARQUIVO + '.tmp', ARQUIVO);
}

const novoId = () => crypto.randomBytes(4).toString('hex');

module.exports = { db, salvar, novoId };
