// =========================================================
// TOCA - o que cada tela faz com a API
// Cada função abaixo roda só na página com o mesmo nome de arquivo.
// =========================================================
(function () {
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const api = (c, o) => TOCA.api(c, o);
    const moeda = TOCA.moeda;
    const ir = u => redirecionar(u);

    const ICONES = { Alimento: '🍕', Doces: '🍰', Bebida: '🥤', Mercado: '🛒', Transporte: '🚌', Lazer: '🎬', Casa: '🏠', Escola: '📚', Mesada: '💰', 'Bônus': '🎁', Outros: '🧾' };
    const icone = l => l.tipo === 'economia' ? '🐷' : (ICONES[l.categoria] || '🧾');
    const semEmoji = t => t.trim().replace(/^\S+\s+/, '');
    const maiuscula = t => t.trim().charAt(0).toUpperCase() + t.trim().slice(1).toLowerCase();

    function item(ic, titulo, sub, direita, href) {
        return '<a href="' + (href || '#') + '" class="item-lista"><div class="icone">' + ic + '</div>' +
            '<div class="info"><strong>' + titulo + '</strong><small>' + sub + '</small></div>' +
            '<div class="text-end">' + (direita || '') + '</div></a>';
    }
    // Troca todos os itens de exemplo (.item-lista) por uma lista vinda da API
    function trocarLista(html, vazio) {
        const itens = $$('.item-lista');
        const ref = itens[0];
        if (ref) { ref.insertAdjacentHTML('beforebegin', html || '<p class="text-muted text-center">' + (vazio || 'Nada por aqui ainda.') + '</p>'); itens.forEach(i => i.remove()); }
    }
    function valorLancamento(l) {
        const sinal = l.tipo === 'gasto' ? '- ' : '+ ';
        const cls = l.tipo === 'gasto' ? 'valor-neg' : 'valor-pos';
        const pend = l.status === 'pendente' ? ' <span class="selo selo-laranja">Pendente</span>' : (l.status === 'recusado' ? ' <span class="selo selo-cinza">Recusado</span>' : '');
        return '<span class="' + cls + '">' + sinal + moeda(l.valor) + '</span>' + pend;
    }
    function linhaLancamento(l, pagina) {
        return item(icone(l), l.descricao || l.categoria, TOCA.dataBR(l.data).slice(0, 5) + ' · ' + (l.filhoNome || 'Família') + ' · ' + l.categoria, valorLancamento(l), pagina + '?id=' + l.id);
    }
    // Formulário: bloqueia o botão enquanto envia e mostra erros
    function enviar(form, botao, fn) {
        const executar = async function (e) {
            if (e) e.preventDefault();
            botao.disabled = true;
            try { await fn(); } catch (err) { alert(err.message); botao.disabled = false; }
        };
        if (form && form.tagName === 'FORM') form.addEventListener('submit', executar);
        else botao.addEventListener('click', executar);
        if (form && form.tagName === 'FORM' && botao.type !== 'submit') botao.addEventListener('click', executar);
    }
    const idDaUrl = () => parametro('id', '');
    const destinoDe = el => (el && el.dataset.destino) || (el && el.closest('form') && el.closest('form').dataset.destino) || '';

    const P = {};

    // ------------------------------------------------ ENTRADA
    P['index.html'] = async function () {
        if (TOCA.token()) { api('/auth/logout', { metodo: 'POST' }).catch(() => { }); TOCA.limparSessao(); }
    };

    P['login.html'] = async function () {
        const f = $('#form-login');
        const [email, senha] = $$('input', f);
        enviar(f, $('button[type=submit]', f), async function () {
            const r = await api('/auth/login', { metodo: 'POST', corpo: { email: email.value, senha: senha.value } });
            TOCA.guardarSessao(r);
            ir(r.usuario.perfil === 'filho' ? 'dashboard-filho.html' : 'dashboard-responsavel.html');
        });
    };

    P['cadastro-responsavel.html'] = async function () {
        const f = $('#form-cadastro');
        const [nome, email, senha, confirmar] = $$('input', f);
        enviar(f, $('button[type=submit]', f), async function () {
            const r = await api('/auth/cadastro', { metodo: 'POST', corpo: { nome: nome.value, email: email.value, senha: senha.value, confirmarSenha: confirmar.value } });
            TOCA.guardarSessao(r);
            ir('onboarding-resp-1.html');
        });
    };

    P['singup.html'] = async function () {
        const f = $('#form-cadastro-filho');
        const [nome, apelido, email, codigo, senha] = $$('input', f);
        if (parametro('codigo', '')) codigo.value = parametro('codigo', '');
        enviar(f, $('button[type=submit]', f), async function () {
            const avatar = $('.avatar-opcao.ativo', f).textContent.trim();
            const r = await api('/auth/cadastro-filho', { metodo: 'POST', corpo: { nome: nome.value, apelido: apelido.value, email: email.value, codigo: codigo.value, senha: senha.value, avatar } });
            TOCA.guardarSessao(r);
            ir('onboarding-filho-2.html');
        });
    };

    // ------------------------------------------------ ONBOARDING DO RESPONSÁVEL
    P['onboarding-resp-1.html'] = async function () {
        const f = $('#form-onb1');
        const [familia, nome] = $$('input', f);
        const u = TOCA.usuario();
        if (u && !nome.value) nome.value = u.nome;
        enviar(f, $('button[type=submit]', f), async function () {
            await api('/familia', { metodo: 'PUT', corpo: { nome: familia.value } });
            await api('/auth/me', { metodo: 'PUT', corpo: { nome: nome.value } });
            ir('onboarding-resp-2.html');
        });
    };

    async function paginaMesada() {
        const f = $('form');
        const valor = $('input.dinheiro', f);
        const salvar = $('button[type=submit], button[type=button]', f);
        const atual = await api('/familia');
        if (atual.mesada.valor > 0) {
            valor.value = atual.mesada.valor.toFixed(2).replace('.', ',');
            $$('.chip-opcao', f).forEach(c => c.classList.toggle('ativo', c.textContent.trim().toLowerCase() === atual.mesada.periodicidade));
            $$('select option', f).forEach(o => { if (o.textContent.trim() === 'Dia ' + atual.mesada.dia) o.selected = true; });
        }
        enviar(f, salvar, async function () {
            await api('/familia/mesada', {
                metodo: 'PUT',
                corpo: { valor: valor.value, periodicidade: $('.chip-opcao.ativo', f).textContent.trim(), dia: parseInt($('select', f).value.replace(/\D/g, ''), 10) }
            });
            ir(destinoDe(salvar) || f.getAttribute('action'));
        });
    }
    P['onboarding-resp-2.html'] = paginaMesada;
    P['configurar-mesada.html'] = paginaMesada;

    async function paginaPorcentagens() {
        const ranges = $$('.range-pct');
        const f = await api('/familia');
        [f.porcentagens.guardar, f.porcentagens.gastar, f.porcentagens.livre].forEach((v, i) => {
            ranges[i].value = v;
            ranges[i].dispatchEvent(new Event('input'));
        });
        const botao = $('#btn-salvar-pct');
        enviar(null, botao, async function () {
            await api('/familia/porcentagens', { metodo: 'PUT', corpo: { guardar: ranges[0].value, gastar: ranges[1].value, livre: ranges[2].value } });
            ir(destinoDe(botao));
        });
    }
    P['onboarding-resp-3.html'] = paginaPorcentagens;
    P['configurar-porcentagens.html'] = paginaPorcentagens;

    P['onboarding-resp-4.html'] = async function () {
        const f = await api('/familia');
        $('#codigo-convite').textContent = f.convite;
        const wa = $('a[href*="wa.me"]');
        if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('Entre na nossa família no TOCA com o código ' + f.convite);
    };

    // ------------------------------------------------ METAS (filho)
    async function paginaCriarMeta() {
        const f = $('#form-meta');
        const [titulo, valor, prazo] = $$('input', f);
        const botao = $('button', f);
        enviar(f, botao, async function () {
            await api('/metas', { metodo: 'POST', corpo: { titulo: titulo.value, valor: valor.value, prazo: prazo.value, icone: $('.avatar-opcao.ativo', f).textContent.trim() } });
            ir(destinoDe(botao));
        });
    }
    P['onboarding-filho-3.html'] = paginaCriarMeta;
    P['criar-meta.html'] = paginaCriarMeta;

    async function metaDaPagina() {
        const id = idDaUrl();
        if (id) return api('/metas/' + id);
        const lista = await api('/metas?status=ativa');
        return lista[0] || null;
    }

    P['minha-meta.html'] = async function () {
        const m = await metaDaPagina();
        if (!m) { $('.card-bege h3').textContent = 'Você ainda não tem meta ativa'; $('.card-bege .progress').remove(); return; }
        $('.card-bege div[style*="3.5rem"]').textContent = m.icone;
        $('.card-bege h3').textContent = m.titulo;
        const barra = $('.progress-bar');
        barra.style.width = m.pct + '%'; barra.textContent = m.pct + '%';
        $('.card-bege strong').textContent = moeda(m.guardado) + ' de ' + moeda(m.valor);
        const [prazo, prev] = $$('.card-saldo p');
        prazo.textContent = m.prazo ? TOCA.dataBR(m.prazo) : 'Sem prazo';
        prev.textContent = TOCA.mesAno(m.previsao ? m.previsao + '-01' : null);
        const impacto = $('.card-toca p');
        if (impacto) impacto.innerHTML = m.faltam > 0
            ? 'Faltam <strong>' + moeda(m.faltam) + '</strong>. ' + (m.noPrazo ? 'No ritmo atual você chega antes do prazo!' : 'No ritmo atual você passa do prazo — que tal guardar um pouco mais?')
            : 'Meta completa! Falta só registrar a compra. 🎉';
        const bonus = $('.item-lista');
        if (m.bonus && m.bonus.length) {
            const ult = m.bonus[m.bonus.length - 1];
            bonus.querySelector('strong').textContent = ult.descricao;
            bonus.querySelector('small').textContent = '+ ' + moeda(ult.valor) + ' · ' + TOCA.dataBR(ult.data);
        } else bonus.remove();
        $$('a[href^="concluir-meta.html"], a[href^="registrar-economia.html"]').forEach(a => a.href = a.getAttribute('href').split('?')[0] + '?id=' + m.id);
        const concluir = $('a[href^="concluir-meta.html"]');
        if (concluir && m.faltam > 0) { concluir.classList.add('disabled'); concluir.textContent = 'FALTAM ' + moeda(m.faltam) + ' PARA CONCLUIR'; }
    };

    P['concluir-meta.html'] = async function () {
        const m = await metaDaPagina();
        const f = $('form');
        const [valor, local, data] = $$('input', f);
        if (m) { valor.value = m.valor.toFixed(2).replace('.', ','); $('.card-bege p').textContent = 'Confirme a compra do seu ' + m.icone + ' ' + m.titulo + '.'; }
        data.value = new Date().toISOString().slice(0, 10);
        const botao = $('button', f);
        enviar(f, botao, async function () {
            if (!m) throw new Error('Você não tem meta ativa para concluir.');
            await api('/metas/' + m.id + '/concluir', { metodo: 'POST', corpo: { valorPago: valor.value, local: local.value, data: data.value } });
            ir(destinoDe(botao));
        });
    };

    P['registrar-economia.html'] = async function () {
        const f = $('form');
        const [valor, data] = $$('input', f);
        data.value = new Date().toISOString().slice(0, 10);
        const botao = $('button[type=button]', f);
        enviar(f, botao, async function () {
            const tipo = $$('.chip-opcao.ativo')[0].textContent.includes('Guardei') ? 'economia' : 'entrada';
            await api('/lancamentos', { metodo: 'POST', corpo: { tipo, valor: valor.value, categoria: $$('.chip-opcao.ativo')[1].textContent.trim(), data: data.value, metaId: idDaUrl() || undefined } });
            ir(destinoDe(botao));
        });
    };

    // ------------------------------------------------ HOME
    P['dashboard-responsavel.html'] = async function () {
        const d = await api('/dashboard');
        $('#nome').textContent = 'Olá, ' + d.nome.split(' ')[0];
        $('#saldo').textContent = moeda(d.saldo);
        $('#gasto').textContent = moeda(d.gastoMes);
        const h = $$('h5').find(x => x.textContent.includes('Notificações'));
        while (h.nextElementSibling) h.nextElementSibling.remove();
        let html = '';
        if (d.pendentes) html += '<a href="central-aprovacoes.html" class="text-decoration-none"><div class="p-3 rounded-3 mb-2 text-white" style="background-color: var(--marrom-escuro);"><strong>' + d.pendentes + ' pedido(s) esperando você</strong><br><small>Toque para aprovar</small></div></a>';
        d.notificacoes.forEach(n => { html += '<a href="' + (n.link || '#') + '" class="text-decoration-none"><div class="p-3 rounded-3 mb-2 text-white" style="background-color: #2e8b57;"><strong>' + n.titulo + '</strong><br><small>' + n.texto + '</small></div></a>'; });
        h.insertAdjacentHTML('afterend', html || '<p class="text-muted">Nenhuma novidade por enquanto.</p>');
    };

    P['dashboard-filho.html'] = async function () {
        const d = await api('/dashboard');
        $('#nome').textContent = 'Oi, ' + d.nome;
        $('#saldo').textContent = moeda(d.saldo);
        $('#semana').textContent = moeda(d.semana);
        $('#streak').textContent = '🔥 ' + d.streak + (d.streak === 1 ? ' dia seguido' : ' dias seguidos');
        if (d.checkinHoje) { const c = $('#btn-checkin'); c.textContent = '✔ Check-in feito'; c.className = 'selo selo-verde fs-6 text-decoration-none'; }
        const m = d.meta;
        if (m) {
            $('#anel-meta').style.setProperty('--pct', m.pct);
            $('#meta-icone').textContent = m.icone;
            $('#meta-pct').textContent = m.pct + '%';
            $('#meta-valores').textContent = moeda(m.guardado) + ' de ' + moeda(m.valor);
        } else {
            $('#anel-meta').style.setProperty('--pct', 0);
            $('#meta-icone').textContent = '🎯';
            $('#meta-pct').textContent = '0%';
            $('#meta-valores').textContent = 'Crie sua primeira meta!';
            $('#anel-meta').parentElement.href = 'criar-meta.html';
        }
    };

    // ------------------------------------------------ GASTOS
    P['registrar-gasto.html'] = async function () {
        const valor = $('#valor'), aviso = $('#aviso');
        const mostrarAviso = dias => { aviso.style.setProperty('display', dias > 0 ? 'flex' : 'none', 'important'); $('#aviso-texto').textContent = 'Isso atrasa sua meta em ' + dias + (dias === 1 ? ' dia' : ' dias'); };
        mostrarAviso(0);
        $('#data').value = new Date().toISOString().slice(0, 10);
        let t;
        valor.addEventListener('input', function () {
            clearTimeout(t);
            t = setTimeout(async function () {
                try { mostrarAviso((await api('/lancamentos/impacto?valor=' + encodeURIComponent(valor.value))).dias); } catch (e) { }
            }, 300);
        });
        const botao = $('#btn-confirmar');
        enviar(null, botao, async function () {
            const r = await api('/lancamentos', { metodo: 'POST', corpo: { tipo: 'gasto', valor: valor.value, categoria: maiuscula($('.categoria-btn.ativo small').textContent), descricao: $('#descricao').value, data: $('#data').value } });
            if (r.aprovacaoId) sessionStorage.setItem('aprovacaoPendente', r.aprovacaoId); else sessionStorage.removeItem('aprovacaoPendente');
            ir('micro-licao.html');
        });
    };

    P['quiz-rapido.html'] = async function () {
        const botao = $('#btn-quiz-continuar');
        const pendente = sessionStorage.getItem('aprovacaoPendente');
        botao.addEventListener('click', function () { ir(pendente ? 'pedir-aprovacao.html' : destinoDe(botao)); });
        const link = $('a[href="pedir-aprovacao.html"]');
        if (link && !pendente) link.remove();
    };

    P['pedir-aprovacao.html'] = async function () {
        const id = sessionStorage.getItem('aprovacaoPendente');
        const valor = $('input.dinheiro');
        const botao = $('button.btn-laranja');
        if (id) { const a = await api('/aprovacoes/' + id); valor.value = a.valor.toFixed(2).replace('.', ','); valor.readOnly = true; }
        enviar(null, botao, async function () {
            if (id) await api('/aprovacoes/' + id, { metodo: 'PUT', corpo: { motivo: $('textarea').value } });
            sessionStorage.removeItem('aprovacaoPendente');
            ir(destinoDe(botao));
        });
    };

    P['registrar-gasto-familiar.html'] = async function () {
        const f = $('form');
        const [valor, descricao, data] = $$('input', f);
        data.value = new Date().toISOString().slice(0, 10);
        const botao = $('button[type=button]', f);
        enviar(f, botao, async function () {
            await api('/lancamentos', { metodo: 'POST', corpo: { tipo: 'gasto', valor: valor.value, categoria: semEmoji($('.chip-opcao.ativo').textContent), descricao: descricao.value, data: data.value } });
            ir(destinoDe(botao));
        });
    };

    // ------------------------------------------------ ENTRADAS
    P['registrar-entrada-pai.html'] = async function () {
        const f = $('form');
        const [valor, descricao, data] = $$('input', f);
        data.value = new Date().toISOString().slice(0, 10);
        const botao = $('button[type=button]', f);
        enviar(f, botao, async function () {
            await api('/lancamentos', { metodo: 'POST', corpo: { tipo: 'entrada', valor: valor.value, categoria: semEmoji($('.chip-opcao.ativo').textContent), descricao: descricao.value, data: data.value } });
            ir(destinoDe(botao));
        });
    };

    P['registrar-mesada-crianca.html'] = async function () {
        const f = $('form');
        const [valor, filhoSelect, descricao, data] = $$('input, select', f);
        data.value = new Date().toISOString().slice(0, 10);
        // Carregar filhos da família
        const membros = await api('/familia/membros');
        const filhos = membros.filter(m => m.perfil === 'filho');
        filhoSelect.innerHTML = '<option value="">Selecione o filho...</option>' + filhos.map(filho => '<option value="' + filho.id + '">' + (filho.apelido || filho.nome) + '</option>').join('');
        const botao = $('button[type=button]', f);
        enviar(f, botao, async function () {
            const filhoId = filhoSelect.value;
            if (!filhoId) throw new Error('Selecione um filho.');
            await api('/lancamentos', { metodo: 'POST', corpo: { tipo: 'entrada', valor: valor.value, categoria: semEmoji($('.chip-opcao.ativo').textContent), descricao: descricao.value || 'Mesada', data: data.value, filhoId: filhoId } });
            ir(destinoDe(botao));
        });
    };

    // ------------------------------------------------ EXTRATOS
    P['extrato-familiar.html'] = async function () {
        const membros = await api('/familia/membros');
        const filtros = { Todos: '', 'Família': '?filhoId=familia', 'Este mês': '?mes=' + new Date().toISOString().slice(0, 7) };
        membros.filter(m => m.perfil === 'filho').forEach(m => { filtros[m.apelido || m.nome] = '?filhoId=' + m.id; });
        // chips de exemplo viram os filtros reais
        const grupo = $('[data-grupo]');
        grupo.innerHTML = Object.keys(filtros).map((n, i) => '<span class="chip-opcao' + (i === 0 ? ' ativo' : '') + '" data-filtro="' + n + '">' + n + '</span>').join('');
        async function carregar(nome) {
            const r = await api('/lancamentos' + filtros[nome]);
            const [ent, sai] = $$('.card-saldo p');
            ent.textContent = moeda(r.totais.entradas); sai.textContent = moeda(r.totais.saidas);
            $$('.item-lista, p.text-muted.text-center').forEach(e => e.remove());
            grupo.parentElement.querySelector('.row.g-2').insertAdjacentHTML('afterend',
                '<div id="lista">' + (r.itens.map(l => linhaLancamento(l, 'detalhe-gasto.html')).join('') || '<p class="text-muted text-center">Nenhum lançamento.</p>') + '</div>');
        }
        $$('.chip-opcao', grupo).forEach(c => c.addEventListener('click', function () { const l = $('#lista'); if (l) l.remove(); carregar(c.dataset.filtro).catch(e => alert(e.message)); }));
        await carregar('Todos');
    };

    P['meu-extrato.html'] = async function () {
        const r = await api('/lancamentos');
        const dash = await api('/dashboard');
        $('.card-bege h2').textContent = moeda(dash.saldo);
        trocarLista(r.itens.map(l => linhaLancamento(l, 'detalhe-lancamento.html')).join(''), 'Você ainda não tem lançamentos.');
    };

    async function paginaDetalheLancamento() {
        const id = idDaUrl();
        if (!id) return;
        const l = await api('/lancamentos/' + id);
        $('.card-bege div[style*="3rem"]').textContent = icone(l);
        const h1 = $('.card-bege h1');
        h1.textContent = (l.tipo === 'gasto' ? '- ' : '+ ') + moeda(l.valor);
        h1.className = (l.tipo === 'gasto' ? 'valor-neg' : 'valor-pos') + ' mb-0';
        $('.card-bege .selo').textContent = l.categoria;
        const linhas = $$('.card-toca .d-flex');
        linhas[0].querySelector('strong').textContent = l.descricao || '-';
        linhas[1].querySelector('strong').textContent = TOCA.dataBR(l.data);
        linhas[2].querySelector('strong').textContent = TOCA.usuario().perfil === 'filho'
            ? ({ feliz: '😄 Feliz', normal: '😐 Normal', arrependido: '😕 Arrependido' }[l.humor] || '-')
            : (l.filhoNome || 'Família');
        const sit = linhas[3].querySelector('.selo');
        sit.textContent = l.status.charAt(0).toUpperCase() + l.status.slice(1);
        sit.className = 'selo ' + (l.status === 'aprovado' ? 'selo-verde' : l.status === 'pendente' ? 'selo-laranja' : 'selo-cinza');
        const recado = $$('.card-toca').find(c => c.textContent.includes('Comentário do'));
        if (recado) { if (l.comentario) recado.querySelector('p').textContent = l.comentario; else recado.remove(); }
        const area = $('textarea'); if (area) area.value = l.comentario || '';
        const excluir = $('#btn-excluir');
        excluir.addEventListener('click', async function () {
            if (!confirm('Excluir este lançamento?')) return;
            try { await api('/lancamentos/' + id, { metodo: 'DELETE' }); ir(destinoDe(excluir)); } catch (e) { alert(e.message); }
        });
        const salvar = $('#btn-comentario');
        if (salvar) enviar(null, salvar, async function () {
            await api('/lancamentos/' + id, { metodo: 'PUT', corpo: { comentario: area.value } });
            ir(destinoDe(salvar));
        });
    }
    P['detalhe-gasto.html'] = paginaDetalheLancamento;
    P['detalhe-lancamento.html'] = paginaDetalheLancamento;

    // ------------------------------------------------ APROVAÇÕES
    function cartaoAprovacao(a) {
        const filho = a.filhoNome;
        let titulo, sub, ic, link;
        if (a.tipo === 'gasto') { ic = a.lancamento ? icone(a.lancamento) : '💸'; titulo = 'Gasto de ' + moeda(a.valor); sub = filho + ' · ' + ((a.lancamento && a.lancamento.descricao) || 'sem descrição'); link = 'detalhe-aprovacao.html?id=' + a.id; }
        else if (a.tipo === 'meta') { ic = a.meta ? a.meta.icone : '🎯'; titulo = 'Nova meta: ' + (a.meta ? a.meta.titulo : ''); sub = filho + ' · ' + moeda(a.valor); link = 'aprovar-meta.html?id=' + a.id; }
        else { ic = '⚙️'; titulo = 'Mudar prazo da meta'; sub = filho + ' pediu até ' + TOCA.dataBR(a.novoPrazo); link = 'detalhe-aprovacao.html?id=' + a.id; }
        const botoes = a.tipo === 'meta'
            ? '<a href="' + link + '" class="btn btn-laranja">Ver meta</a>'
            : '<div class="d-flex gap-2"><button class="btn btn-verde" data-decidir="' + a.id + '" data-aprovar="true">Aprovar</button><button class="btn btn-vermelho-outline" data-decidir="' + a.id + '" data-aprovar="false">Recusar</button></div>';
        return '<div class="card-toca"><a href="' + link + '" class="text-decoration-none text-reset d-flex align-items-center gap-3 mb-3"><div class="fs-2">' + ic + '</div><div class="flex-grow-1"><strong class="text-marrom">' + titulo + '</strong><br><small class="text-muted">' + sub + '</small></div></a>' + botoes + '</div>';
    }

    P['central-aprovacoes.html'] = async function () {
        const [pend, hist] = await Promise.all([api('/aprovacoes?status=pendente'), api('/aprovacoes?status=historico')]);
        $('#pendentes').innerHTML = pend.map(cartaoAprovacao).join('') || '<p class="text-muted text-center">Nada pendente. 🎉</p>';
        $('#historico').innerHTML = hist.map(a => item(a.status === 'aprovado' ? '✅' : '❌',
            a.tipo === 'gasto' ? 'Gasto de ' + moeda(a.valor) : a.tipo === 'meta' ? 'Meta: ' + (a.meta ? a.meta.titulo : '') : 'Prazo da meta',
            (a.status === 'aprovado' ? 'Aprovado' : 'Recusado') + ' em ' + TOCA.dataBR((a.decididaEm || '').slice(0, 10)),
            '<span class="selo ' + (a.status === 'aprovado' ? 'selo-verde' : 'selo-cinza') + '">' + (a.status === 'aprovado' ? 'OK' : 'Recusado') + '</span>')).join('') || '<p class="text-muted text-center">Sem histórico ainda.</p>';
        const badge = $('.badge'); if (badge) { badge.textContent = pend.length; badge.style.display = pend.length ? '' : 'none'; }
        $$('[data-decidir]').forEach(b => b.addEventListener('click', async function () {
            b.disabled = true;
            const aprovar = b.dataset.aprovar === 'true';
            try {
                await api('/aprovacoes/' + b.dataset.decidir + '/decidir', { metodo: 'POST', corpo: { aprovar } });
                ir(TOCA.sucesso(aprovar ? 'Aprovado!' : 'Recusado', 'O pedido foi respondido e o filho já foi avisado.', 'central-aprovacoes.html'));
            } catch (e) { alert(e.message); b.disabled = false; }
        }));
    };

    P['detalhe-aprovacao.html'] = async function () {
        const a = await api('/aprovacoes/' + idDaUrl());
        $('.avatar-grande').textContent = a.filhoAvatar;
        if (a.tipo === 'gasto') {
            $('#ap-nome').textContent = a.filhoNome + ' quer gastar';
            $('#ap-valor').textContent = moeda(a.valor);
            $('#ap-categoria').textContent = a.lancamento ? a.lancamento.categoria : '';
            $('#ap-aviso').textContent = '⚠️ Esse gasto atrasa a meta em ' + a.impactoDias + ' dias.';
        } else {
            $('#ap-nome').textContent = a.filhoNome + ' quer mudar o prazo para';
            $('#ap-valor').textContent = TOCA.dataBR(a.novoPrazo);
            $('#ap-categoria').textContent = 'Prazo da meta';
            $('#ap-aviso').remove();
        }
        $('#ap-motivo').textContent = a.motivo ? '“' + a.motivo + '”' : 'O filho não escreveu um motivo.';
        if (a.status !== 'pendente') $$('[data-acao]').forEach(b => b.remove());
        $$('[data-acao]').forEach(b => b.addEventListener('click', async function () {
            const aprovar = b.dataset.acao === 'aprovar';
            b.disabled = true;
            try {
                await api('/aprovacoes/' + a.id + '/decidir', { metodo: 'POST', corpo: { aprovar, comentario: $('#ap-comentario').value } });
                ir(TOCA.sucesso(aprovar ? 'Pedido aprovado' : 'Pedido recusado', a.filhoNome + ' foi avisado agora mesmo.', 'central-aprovacoes.html'));
            } catch (e) { alert(e.message); b.disabled = false; }
        }));
    };

    P['aprovar-meta.html'] = async function () {
        const a = await api('/aprovacoes/' + idDaUrl());
        const m = a.meta;
        $('.card-bege div[style*="3.5rem"]').textContent = m.icone;
        $('.card-bege h3').textContent = m.titulo;
        $('.card-bege p').textContent = 'Sugerida por ' + a.filhoNome;
        const [valor, prazo] = $$('.card-saldo p');
        valor.textContent = moeda(m.valor);
        prazo.textContent = m.prazo ? TOCA.dataBR(m.prazo) : 'Sem prazo';
        $('.card-toca p').textContent = m.previsao ? 'Com a regra atual, a meta é atingida em ' + TOCA.mesAno(m.previsao + '-01') + '.' : 'Configure a mesada para ver a previsão.';
        const alerta = $('.alert'); if (m.noPrazo) alerta.remove();
        const ajuste = $('input.dinheiro');
        $$('[data-acao]').forEach(b => b.addEventListener('click', async function () {
            const acao = b.dataset.acao;
            b.disabled = true;
            try {
                await api('/aprovacoes/' + a.id + '/decidir', { metodo: 'POST', corpo: { aprovar: acao !== 'recusar', valorAjustado: acao === 'ajustar' ? ajuste.value : undefined } });
                ir(TOCA.sucesso(acao === 'recusar' ? 'Meta recusada' : 'Meta aprovada!', a.filhoNome + ' foi avisado.', 'painel-filho.html'));
            } catch (e) { alert(e.message); b.disabled = false; }
        }));
    };

    // ------------------------------------------------ OUTRAS TELAS
    P['notificacoes.html'] = async function () {
        const lista = await api('/notificacoes');
        $$('h6').forEach(h => h.remove());
        trocarLista(lista.map(n => item('🔔', n.titulo, n.texto || TOCA.dataBR(n.criadaEm.slice(0, 10)), n.lida ? '' : '<span class="selo selo-laranja">Novo</span>', n.link)).join(''), 'Nenhuma notificação.');
        if (lista.some(n => !n.lida)) api('/notificacoes/lidas', { metodo: 'POST' }).catch(() => { });
    };

    P['checkin-diario.html'] = async function () {
        const botao = $('.sheet button.btn-laranja');
        const sheet = $('.sheet');
        enviar(null, botao, async function () {
            const r = await api('/checkin', { metodo: 'POST', corpo: { saldo: $('input.dinheiro', sheet).value, humor: $('.avatar-opcao.ativo', sheet).textContent.trim() } });
            ir(TOCA.sucesso('Check-in feito!', 'Sua sequência chegou a ' + r.streak + (r.streak === 1 ? ' dia' : ' dias seguidos') + '. 🔥', 'dashboard-filho.html'));
        });
    };

    P['dica-do-dia.html'] = async function () {
        $('.card-bege p').textContent = (await api('/dica-do-dia')).texto;
    };

    P['missoes.html'] = async function () {
        const lista = await api('/missoes');
        trocarLista(lista.map(m => '<a href="detalhe-missao.html" class="item-lista"><div class="icone">' + m.icone + '</div><div class="info"><strong>' + m.titulo + '</strong><small>' + m.atual + ' de ' + m.meta + ' · +' + m.bolotas + ' 🌰' + (m.concluida ? ' · ✅ feita' : '') + '</small><div class="progress progress-toca mt-1" style="height:8px"><div class="progress-bar" style="width:' + Math.round(m.atual / m.meta * 100) + '%"></div></div></div></a>').join(''));
    };

    P['conquistas.html'] = async function () {
        const c = await api('/conquistas');
        $('.row.g-2.mb-3.text-center').innerHTML = c.selos.map(s => '<div class="col-4"><div class="card-bege mb-0' + (s.desbloqueada ? '' : ' opacity-50') + '"><div class="fs-1">' + (s.desbloqueada ? s.icone : '🔒') + '</div><small class="fw-bold ' + (s.desbloqueada ? 'text-marrom' : '') + '">' + s.nome + '</small></div></div>').join('');
        trocarLista(c.historico.map(h => item(h.icone, 'Meta batida: ' + h.titulo, TOCA.dataBR((h.data || '').slice(0, 10)), '<span class="selo selo-verde">' + moeda(h.valor) + '</span>')).join(''), 'Bata sua primeira meta para aparecer aqui!');
    };

    P['ranking.html'] = async function () {
        const r = await api('/ranking');
        const chave = $('.form-check'); if (chave) chave.remove(); // quem liga/desliga é o responsável
        const medalhas = ['🥇', '🥈', '🥉'];
        trocarLista(r.ativo ? r.itens.map((x, i) => '<div class="item-lista"' + (x.voce ? ' style="border-color: var(--laranja-primario);"' : '') + '><div class="icone">' + (medalhas[i] || (i + 1)) + '</div><div class="info"><strong>' + x.nome + (x.voce ? ' (você)' : '') + '</strong><small>🔥 ' + x.sequencia + ' dias seguidos</small></div></div>').join('') : '', 'O responsável ainda não ativou o ranking.');
    };

    P['relatorio-mensal.html'] = async function () {
        const r = await api('/relatorio');
        const [g, s] = $$('.card-saldo p');
        g.textContent = moeda(r.guardado); s.textContent = moeda(r.gasto);
        const max = Math.max(1, ...r.semanas);
        $$('.barra-mes div').forEach((b, i) => b.style.height = Math.max(4, Math.round(r.semanas[i] / max * 100)) + '%');
        const barras = $$('.progress-bar');
        const pcts = [r.emocional.feliz, r.emocional.normal, r.emocional.arrependido];
        const rotulos = $$('.card-toca strong').filter(x => x.textContent.includes('%'));
        pcts.forEach((p, i) => { barras[i].style.width = p + '%'; if (rotulos[i]) rotulos[i].textContent = p + '%'; });
    };

    P['metas-filho.html'] = async function () {
        const [ativas, concluidas] = await Promise.all([api('/metas?status=ativa'), api('/metas?status=concluida')]);
        $('#ativas').innerHTML = ativas.map(m => '<a href="detalhe-meta-responsavel.html?id=' + m.id + '" class="item-lista"><div class="icone">' + m.icone + '</div><div class="info"><strong>' + m.titulo + '</strong><small>' + moeda(m.guardado) + ' de ' + moeda(m.valor) + '</small><div class="progress progress-toca mt-1" style="height:8px"><div class="progress-bar" style="width:' + m.pct + '%"></div></div></div><strong>' + m.pct + '%</strong></a>').join('') || '<p class="text-muted text-center">Nenhuma meta ativa.</p>';
        $('#concluidas').innerHTML = concluidas.map(m => item(m.icone, m.titulo, 'Concluída', '<span class="selo selo-verde">100%</span>')).join('') || '<p class="text-muted text-center">Nenhuma meta concluída ainda.</p>';
    };

    P['detalhe-meta-responsavel.html'] = async function () {
        const m = await api('/metas/' + idDaUrl());
        $('.card-bege div[style*="3.5rem"]').textContent = m.icone;
        $('.card-bege h3').textContent = m.titulo;
        $('.progress-bar').style.width = m.pct + '%';
        $('.card-bege strong').textContent = moeda(m.guardado) + ' de ' + moeda(m.valor);
        const [prev, faltam] = $$('.card-saldo p');
        prev.textContent = TOCA.mesAno(m.previsao ? m.previsao + '-01' : null); faltam.textContent = moeda(m.faltam);
        const botao = $('.card-toca button');
        enviar(null, botao, async function () {
            await api('/metas/' + m.id + '/bonus', { metodo: 'POST', corpo: { valor: $('input.dinheiro').value } });
            ir(destinoDe(botao));
        });
    };

    P['painel-filho.html'] = async function () {
        const d = await api('/dashboard');
        const filho = d.filhos[0];
        if (!filho) { $('h3').textContent = 'Nenhum filho ainda'; return; }
        $('.avatar-grande').textContent = filho.avatar;
        $('h3').textContent = filho.nome;
        $('.selo-laranja').textContent = '🔥 ' + filho.streak + ' dias seguidos';
        const metas = await api('/metas?status=ativa&filhoId=' + filho.id);
        const m = metas[0];
        const card = $('.card-toca');
        if (m) {
            card.querySelector('strong').textContent = m.icone + ' ' + m.titulo;
            card.querySelector('.d-flex strong:last-child').textContent = m.pct + '%';
            card.querySelector('.progress-bar').style.width = m.pct + '%';
            card.querySelector('small').textContent = moeda(m.guardado) + ' de ' + moeda(m.valor);
        } else card.innerHTML = '<span class="text-muted">Sem meta ativa.</span>';
        const extr = await api('/lancamentos?filhoId=' + filho.id + '&mes=' + new Date().toISOString().slice(0, 7));
        const [guardou, gastou] = $$('.card-saldo p');
        guardou.textContent = moeda(metas.reduce((s, x) => s + x.guardado, 0)); gastou.textContent = moeda(extr.totais.saidas);
        const pend = $('a.btn[href="central-aprovacoes.html"]');
        if (pend) pend.textContent = 'APROVAÇÕES PENDENTES (' + d.pendentes + ')';
    };

    P['regra-porcentagens.html'] = async function () {
        const f = await api('/familia');
        const v = f.mesada.valor;
        $('.card-bege h2').textContent = moeda(v);
        const partes = [f.porcentagens.guardar, f.porcentagens.gastar, f.porcentagens.livre];
        $$('.card-toca').forEach((c, i) => {
            c.querySelector('.d-flex strong:last-child').textContent = partes[i] + '% · ' + moeda(v * partes[i] / 100);
            c.querySelector('.progress-bar').style.width = partes[i] + '%';
        });
    };

    // perfis
    async function paginaPerfil() {
        const u = await api('/auth/me');
        $('h3').textContent = u.nome;
        $('.avatar-grande').textContent = u.avatar;
        const pequeno = $('small.text-muted');
        const f = await api('/familia');
        pequeno.textContent = u.perfil === 'responsavel' ? u.email + ' · Plano ' + f.plano : f.nome;
    }
    P['perfil-responsavel.html'] = paginaPerfil;
    P['perfil-filho.html'] = paginaPerfil;

    P['gerenciar-membros.html'] = async function () {
        const m = await api('/familia/membros');
        const eu = TOCA.usuario();
        trocarLista(m.map(x => item(x.avatar, x.apelido || x.nome, x.perfil === 'filho' ? 'Filho' : 'Responsável',
            '<span class="selo ' + (x.perfil === 'filho' ? 'selo-laranja' : 'selo-marrom') + '">' + (x.perfil === 'filho' ? 'Filho' : 'Responsável') + '</span>', x.perfil === 'filho' ? 'permissoes-filho.html' : '#')).join(''));
        const remover = $('.btn-vermelho-outline');
        const filhos = m.filter(x => x.perfil === 'filho');
        remover.addEventListener('click', async function () {
            if (!filhos.length) return alert('Não há filhos para remover.');
            const nome = prompt('Qual membro remover? Digite: ' + filhos.map(f => f.apelido || f.nome).join(', '));
            const alvo = filhos.find(f => (f.apelido || f.nome).toLowerCase() === (nome || '').trim().toLowerCase());
            if (!alvo) return;
            try { await api('/familia/membros/' + alvo.id, { metodo: 'DELETE' }); window.location.reload(); } catch (e) { alert(e.message); }
        });
    };

    // páginas só com interruptores
    function paginaInterruptores(carregar, salvar, mapa) {
        return async function () {
            const dados = await carregar();
            Object.keys(mapa).forEach(id => { const el = $('#' + id); if (el && dados[mapa[id]] !== undefined) el.checked = !!dados[mapa[id]]; });
            const botao = $('button.btn-laranja');
            enviar(null, botao, async function () {
                const corpo = {};
                Object.keys(mapa).forEach(id => { const el = $('#' + id); if (el) corpo[mapa[id]] = el.checked; });
                const limite = $('input[type=number]'); if (limite) corpo.limiteSemAprovacao = limite.value;
                await salvar(corpo);
                ir(destinoDe(botao));
            });
            const limite = $('input[type=number]'); if (limite && dados.limiteSemAprovacao !== undefined) limite.value = dados.limiteSemAprovacao;
        };
    }
    P['permissoes-filho.html'] = paginaInterruptores(async () => (await api('/familia')).permissoes, c => api('/familia/permissoes', { metodo: 'PUT', corpo: c }), { p2: 'filhoCriaMetas', p3: 'filhoAlteraPrazo', p5: 'rankingAtivo' });
    P['configurar-privacidade.html'] = paginaInterruptores(async () => (await api('/familia')).privacidade, c => api('/familia/privacidade', { metodo: 'PUT', corpo: c }), { v1: 'saldoParaOutrosResponsaveis', v2: 'conquistasComAmigos', v3: 'dadosParaDicas', v4: 'emailsNovidades' });
    P['config-notificacoes.html'] = paginaInterruptores(() => api('/notificacoes-config'), c => api('/notificacoes-config', { metodo: 'PUT', corpo: c }), { n1: 'checkin', n2: 'aprovacoes', n3: 'metas', n4: 'resumo', n5: 'dica' });

    P['assinatura.html'] = async function () {
        const botao = $('.card-bege button');
        enviar(null, botao, async function () {
            await api('/familia/plano', { metodo: 'PUT', corpo: { plano: 'premium' } });
            ir(destinoDe(botao));
        });
    };

    P['exportar-dados.html'] = async function () {
        const botao = $('.sheet button.btn-laranja');
        enviar(null, botao, async function () {
            const formato = $$('[data-grupo]')[1].querySelector('.ativo').textContent.trim() === 'CSV' ? 'csv' : 'json';
            await TOCA.baixar('/exportar?formato=' + formato, 'toca-dados.' + formato);
            botao.disabled = false;
        });
    };

    P['dicas-semanais.html'] = async function () {
        const dicas = await api('/dicas');
        $$('.card-bege').forEach(c => c.remove());
        $('p.text-muted').insertAdjacentHTML('afterend', dicas.map(d => '<div class="card-bege"><strong class="text-marrom">' + d.icone + ' ' + d.titulo + '</strong><p class="mb-0">' + d.texto + '</p></div>').join(''));
    };

    P['biblioteca-educativa.html'] = async function () {
        const lista = await api('/biblioteca');
        trocarLista(lista.map(c => item(c.icone, c.titulo, c.tipo + ' · ' + c.minutos + ' min', '›', 'detalhe-conteudo.html?id=' + c.id)).join(''));
    };

    // ------------------------------------------------ executa a função da página atual
    document.addEventListener('DOMContentLoaded', function () {
        const nome = window.location.pathname.split('/').pop() || 'index.html';
        if (!P[nome]) return;
        Promise.resolve().then(P[nome]).catch(function (err) {
            if (err.offline) window.location.href = 'erro-offline.html';
            else if (err.status !== 401) alert(err.message);
        });
    });
})();
