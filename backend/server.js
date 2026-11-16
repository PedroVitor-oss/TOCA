// TOCA - servidor: API em /api e o site (pasta ../page) na mesma porta.
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/familia', require('./routes/familia'));
app.use('/api/metas', require('./routes/metas'));
app.use('/api/lancamentos', require('./routes/lancamentos'));
app.use('/api/aprovacoes', require('./routes/aprovacoes'));
app.use('/api', require('./routes/extras'));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Site estático (index.html, pages/, css/, js/)
app.use(express.static(path.join(__dirname, '..', 'page')));

// Erros inesperados viram JSON (o front mostra a mensagem)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ erro: 'Algo deu errado no servidor.' });
});

app.listen(PORTA, () => console.log(`TOCA rodando em http://localhost:${PORTA}`));
