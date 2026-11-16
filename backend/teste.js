// Teste de fumaça: com o servidor rodando, execute: node teste.js
const B = process.env.API || 'http://localhost:3000/api';
let falhas = 0;
async function api(caminho, token, metodo = 'GET', corpo) {
    const r = await fetch(B + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, dados: j };
}
function ok(nome, cond, extra) { console.log((cond ? '✔ ' : '✘ ') + nome + (cond ? '' : '  -> ' + JSON.stringify(extra))); if (!cond) falhas++; }

(async () => {
    const sufixo = Date.now();
    // responsável
    let r = await api('/auth/cadastro', null, 'POST', { nome: 'Teste Pai', email: `pai${sufixo}@t.com`, senha: '123456', confirmarSenha: '123456' });
    ok('cadastro responsável', r.status === 201, r.dados); const pai = r.dados.token;
    r = await api('/familia', pai, 'PUT', { nome: 'Família Teste' }); ok('nome da família', r.status === 200, r.dados);
    r = await api('/familia/mesada', pai, 'PUT', { valor: '150,00', periodicidade: 'Mensal', dia: 5 }); ok('mesada', r.dados.valor === 150, r.dados);
    r = await api('/familia/porcentagens', pai, 'PUT', { guardar: 60, gastar: 30, livre: 20 }); ok('porcentagens inválidas (110%) recusadas', r.status === 400, r.dados);
    r = await api('/familia/porcentagens', pai, 'PUT', { guardar: 50, gastar: 30, livre: 20 }); ok('porcentagens', r.status === 200, r.dados);
    r = await api('/familia', pai); const codigo = r.dados.convite; ok('código de convite', /^TOCA-/.test(codigo), r.dados);
    // filho
    r = await api('/auth/cadastro-filho', null, 'POST', { nome: 'Filho', apelido: 'Fi', email: `fi${sufixo}@t.com`, senha: '123456', codigo: 'ERRADO' }); ok('convite inválido recusado', r.status === 404, r.dados);
    r = await api('/auth/cadastro-filho', null, 'POST', { nome: 'Filho', apelido: 'Fi', email: `fi${sufixo}@t.com`, senha: '123456', codigo, avatar: '🐻' }); ok('cadastro filho', r.status === 201, r.dados); const filho = r.dados.token;
    r = await api('/auth/login', null, 'POST', { email: `fi${sufixo}@t.com`, senha: 'errada' }); ok('login errado -> 401', r.status === 401, r.dados);
    r = await api('/dashboard', filho); ok('dashboard filho sem meta', r.status === 200 && r.dados.meta === null, r.dados);
    // meta + aprovação
    r = await api('/metas', filho, 'POST', { titulo: 'Fone', icone: '🎧', valor: '900,00', prazo: '2027-12-01' }); ok('criar meta (pendente)', r.dados.status === 'pendente', r.dados); const metaId = r.dados.id;
    r = await api('/aprovacoes?status=pendente', pai); ok('pai vê pedido de meta', r.dados.length === 1 && r.dados[0].tipo === 'meta', r.dados); const apMeta = r.dados[0].id;
    r = await api(`/aprovacoes/${apMeta}/decidir`, filho, 'POST', { aprovar: true }); ok('filho não pode aprovar (403)', r.status === 403, r.dados);
    r = await api(`/aprovacoes/${apMeta}/decidir`, pai, 'POST', { aprovar: true, valorAjustado: 100 }); ok('pai aprova e ajusta meta', r.status === 200 && r.dados.meta.status === 'ativa' && r.dados.meta.valor === 100, r.dados);
    r = await api(`/aprovacoes/${apMeta}/decidir`, pai, 'POST', { aprovar: true }); ok('decidir 2x -> 409', r.status === 409, r.dados);
    // dinheiro
    r = await api('/familia/mesada/pagar', pai, 'POST'); ok('pagar mesada', r.status === 200, r.dados);
    r = await api('/dashboard', filho); ok('saldo = 75 e meta com 75 guardado', r.dados.saldo === 75 && r.dados.meta.guardado === 75, r.dados);
    r = await api('/lancamentos', filho, 'POST', { tipo: 'gasto', valor: '10,00', categoria: 'Alimento', descricao: 'lanche', humor: 'feliz' }); ok('gasto pequeno aprovado direto', r.status === 201 && !r.dados.precisaAprovacao && r.dados.impactoDias > 0, r.dados);
    r = await api('/lancamentos', filho, 'POST', { tipo: 'gasto', valor: 50, categoria: 'Lazer' }); ok('gasto grande pede aprovação', r.dados.precisaAprovacao === true, r.dados); const apGasto = r.dados.aprovacaoId;
    r = await api(`/aprovacoes/${apGasto}`, filho, 'PUT', { motivo: 'cinema' }); ok('filho explica motivo', r.dados.motivo === 'cinema', r.dados);
    r = await api('/dashboard', filho); ok('saldo ignora gasto pendente (65)', r.dados.saldo === 65, r.dados);
    r = await api(`/aprovacoes/${apGasto}/decidir`, pai, 'POST', { aprovar: true, comentario: 'ok' }); ok('pai aprova gasto', r.dados.status === 'aprovado', r.dados);
    r = await api('/dashboard', filho); ok('saldo após aprovação (15)', r.dados.saldo === 15, r.dados);
    r = await api('/lancamentos', pai, 'POST', { tipo: 'gasto', valor: 80, categoria: 'Mercado' }); ok('pai registra gasto familiar', r.status === 201 && r.dados.lancamento.filhoId === null, r.dados);
    r = await api('/lancamentos?filhoId=familia', pai); ok('extrato familiar filtra', r.dados.itens.length === 1, r.dados);
    r = await api('/metas/' + metaId + '/bonus', pai, 'POST', { valor: 25 }); ok('bônus completa meta (100/100)', r.dados.pct === 100, r.dados);
    // check-in, missões, conquistas
    r = await api('/checkin', filho, 'POST', { saldo: '15,00', humor: '😄' }); ok('check-in', r.dados.streak === 1, r.dados);
    r = await api('/missoes', filho); ok('missões', r.dados.length === 3 && r.dados[1].atual === 1, r.dados);
    // concluir
    r = await api(`/metas/${metaId}/concluir`, filho, 'POST', { valorPago: '99,90', local: 'Loja' }); ok('concluir meta', r.status === 200 && r.dados.sugestoes.length === 3, r.dados);
    r = await api('/conquistas', filho); ok('selo meta batida', r.dados.selos.find(s => s.id === 'batida').desbloqueada, r.dados);
    // extras
    r = await api('/notificacoes', pai); ok('pai tem notificações', r.dados.length >= 3, r.dados);
    r = await api('/notificacoes/lidas', pai, 'POST'); ok('marcar lidas', r.dados.ok, r.dados);
    r = await api('/relatorio', pai); ok('relatório', r.status === 200 && r.dados.gasto === 60, r.dados);
    r = await api('/ranking', filho); ok('ranking desligado por padrão', r.dados.ativo === false, r.dados);
    r = await api('/familia/permissoes', pai, 'PUT', { rankingAtivo: true }); r = await api('/ranking', filho); ok('ranking ligado só mostra sequência', r.dados.itens[0].sequencia === 1 && r.dados.itens[0].valor === undefined, r.dados);
    r = await api('/exportar?formato=csv', pai); ok('exportar csv', typeof r.dados === 'string' && r.dados.includes('data;tipo'), r.dados);
    r = await api('/dicas', pai); ok('dicas', r.dados.length >= 1, r.dados);
    r = await api('/dashboard'); ok('sem token -> 401', r.status === 401, r.dados);
    console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo!');
    process.exit(falhas ? 1 : 0);
})();
