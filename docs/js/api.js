// =========================================================
// TOCA - comunicação com o backend (fetch)
// Uso:  const dados = await TOCA.api('/metas');
//       await TOCA.api('/lancamentos', { metodo: 'POST', corpo: { valor: 10 } });
// =========================================================
const TOCA = {
    // Se o site for aberto pelo servidor (porta 3000) usa caminho relativo;
    // senão (Live Server, arquivo local) aponta para o backend local.
    // Para outro endereço: window.TOCA_API_URL = 'https://meu-servidor.com' antes deste script.
    url: window.TOCA_API_URL !== undefined
        ? window.TOCA_API_URL
        : (location.protocol.startsWith('http') && location.port === '3000' ? '' : 'http://localhost:3000'),

    token() { return localStorage.getItem('toca_token'); },
    usuario() { return JSON.parse(localStorage.getItem('toca_usuario') || 'null'); },
    guardarSessao(r) {
        localStorage.setItem('toca_token', r.token);
        localStorage.setItem('toca_usuario', JSON.stringify(r.usuario));
    },
    limparSessao() {
        localStorage.removeItem('toca_token');
        localStorage.removeItem('toca_usuario');
    },

    async api(caminho, opcoes) {
        const o = opcoes || {};
        let resp;
        try {
            resp = await fetch(this.url + '/api' + caminho, {
                method: o.metodo || 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' },
                    this.token() ? { Authorization: 'Bearer ' + this.token() } : {}),
                body: o.corpo ? JSON.stringify(o.corpo) : undefined
            });
        } catch (e) {
            const erro = new Error('Não foi possível falar com o servidor. Ele está ligado?');
            erro.offline = true;
            throw erro;
        }
        // Sessão expirada: volta para o login (menos nas rotas de login/cadastro)
        if (resp.status === 401 && caminho.indexOf('/auth/') !== 0) {
            this.limparSessao();
            window.location.href = 'login.html';
        }
        const dados = await resp.json().catch(function () { return {}; });
        if (!resp.ok) {
            const erro = new Error(dados.erro || 'Algo deu errado.');
            erro.status = resp.status;
            throw erro;
        }
        return dados;
    },

    // Baixa um arquivo (CSV/JSON) protegido por login
    async baixar(caminho, nomeArquivo) {
        const resp = await fetch(this.url + '/api' + caminho, { headers: { Authorization: 'Bearer ' + this.token() } });
        if (!resp.ok) throw new Error('Não foi possível gerar o arquivo.');
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nomeArquivo;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    moeda(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); },
    dataBR(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '-'; },
    mesAno(s) {
        if (!s) return '-';
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return meses[parseInt(s.slice(5, 7), 10) - 1] + '/' + s.slice(0, 4);
    },
    // URL da tela de sucesso (T60)
    sucesso(titulo, msg, destino) {
        return 'sucesso.html?titulo=' + encodeURIComponent(titulo) + '&msg=' + encodeURIComponent(msg) + '&destino=' + destino;
    }
};
