// =========================================================
// TOCA - script simples e compartilhado por todas as telas
// =========================================================

// Redirecionar para outra página
function redirecionar(url) {
    window.location.href = url;
}

// Ler parâmetro da URL (?chave=valor)
function parametro(nome, padrao) {
    var valor = new URLSearchParams(window.location.search).get(nome);
    return valor !== null ? valor : padrao;
}

document.addEventListener("DOMContentLoaded", function () {

    // 1) Chips / categorias / avatares: seleciona um por grupo (data-grupo)
    //    Se o grupo tiver data-multiplo="true", permite marcar vários.
    document.querySelectorAll("[data-grupo]").forEach(function (grupo) {
        var itens = grupo.querySelectorAll(".chip-opcao, .avatar-opcao, .categoria-btn, .opcao-selecionavel");
        itens.forEach(function (item) {
            item.addEventListener("click", function () {
                if (item.classList.contains("bloqueado")) return;
                if (grupo.dataset.multiplo === "true") {
                    item.classList.toggle("ativo");
                } else {
                    itens.forEach(function (i) { i.classList.remove("ativo"); });
                    item.classList.add("ativo");
                }
            });
        });
    });

    // 2) Perfil escolhido no início (index -> login)
    var perfil = parametro("perfil", "responsavel");
    var formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.action = perfil === "filho" ? "dashboard-filho.html" : "dashboard-responsavel.html";
        var linkCriar = document.getElementById("link-criar-conta");
        if (linkCriar) linkCriar.href = perfil === "filho" ? "singup.html" : "cadastro-responsavel.html";
    }

    // 3) Porcentagens da mesada (soma deve dar 100%)
    var ranges = document.querySelectorAll(".range-pct");
    if (ranges.length) {
        var atualizarPct = function () {
            var total = 0;
            ranges.forEach(function (r) {
                total += parseInt(r.value, 10);
                var rotulo = document.getElementById(r.dataset.rotulo);
                if (rotulo) rotulo.textContent = r.value + "%";
            });
            var aviso = document.getElementById("total-pct");
            var botao = document.getElementById("btn-salvar-pct");
            if (aviso) {
                aviso.textContent = "Total: " + total + "%";
                aviso.className = total === 100 ? "fw-bold text-success" : "fw-bold text-danger";
            }
            if (botao) botao.disabled = total !== 100;
        };
        ranges.forEach(function (r) { r.addEventListener("input", atualizarPct); });
        atualizarPct();
    }

    // 4) Quiz: marca certa/errada e libera o botão continuar
    document.querySelectorAll(".opcao-quiz").forEach(function (op) {
        op.addEventListener("click", function () {
            document.querySelectorAll(".opcao-quiz").forEach(function (o) {
                o.disabled = true;
                if (o.dataset.certa === "true") o.classList.add("certa");
            });
            if (op.dataset.certa !== "true") op.classList.add("errada");
            var fb = document.getElementById("feedback-quiz");
            if (fb) fb.classList.remove("d-none");
        });
    });

    // 5) Copiar código de convite
    var btnCopiar = document.getElementById("btn-copiar");
    if (btnCopiar) {
        btnCopiar.addEventListener("click", function () {
            var codigo = document.getElementById("codigo-convite").textContent.trim();
            if (navigator.clipboard) navigator.clipboard.writeText(codigo);
            btnCopiar.textContent = "COPIADO ✓";
        });
    }

    // 6) Tela de sucesso e de confirmação (textos vêm da URL)
    var tituloSucesso = document.getElementById("sucesso-titulo");
    if (tituloSucesso) {
        tituloSucesso.textContent = parametro("titulo", "Tudo certo!");
        document.getElementById("sucesso-msg").textContent = parametro("msg", "Ação concluída com sucesso.");
        document.getElementById("sucesso-btn").onclick = function () {
            redirecionar(parametro("destino", "../index.html"));
        };
    }
    var tituloConfirma = document.getElementById("confirma-titulo");
    if (tituloConfirma) {
        tituloConfirma.textContent = parametro("titulo", "Tem certeza?");
        document.getElementById("confirma-msg").textContent = parametro("msg", "Essa ação não poderá ser desfeita.");
        document.getElementById("confirma-sim").onclick = function () {
            redirecionar(parametro("destino", "../index.html"));
        };
    }

    // 7) Formata campos de dinheiro ao sair do campo
    document.querySelectorAll("input.dinheiro").forEach(function (campo) {
        campo.addEventListener("blur", function () {
            var n = parseFloat(String(campo.value).replace(",", "."));
            if (!isNaN(n)) campo.value = n.toFixed(2).replace(".", ",");
        });
    });

    // 8) Botão "tentar novamente" da tela de erro
    var btnTentar = document.getElementById("btn-tentar");
    if (btnTentar) btnTentar.onclick = function () { window.location.reload(); };

    // 9) Simulação de carregamento (T58): depois de 2,5s vai para o destino
    var carregando = document.getElementById("tela-carregando");
    if (carregando) {
        setTimeout(function () { redirecionar(carregando.dataset.destino); }, 2500);
    }
});
