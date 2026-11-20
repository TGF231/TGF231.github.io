// Página em etapas: contador no topo, menu Etapas, "Próxima etapa" e troca de tema.
// Sem dependências.
(function () {
  "use strict";

  var raiz = document.documentElement;

  // Tema: claro ou escuro, lembrado neste navegador. Sem escolha salva, segue o sistema.
  var botaoTema = document.getElementById("tema");
  if (botaoTema) {
    botaoTema.addEventListener("click", function () {
      var atual = raiz.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro");
      var novo = atual === "claro" ? "escuro" : "claro";
      raiz.setAttribute("data-theme", novo);
      try { localStorage.setItem("tema", novo); } catch (e) { /* armazenamento bloqueado: vale só nesta visita */ }
    });
  }

  // Menu Etapas: abre e fecha no botão, fecha com Esc, clique fora ou ao escolher.
  var botaoMenu = document.getElementById("etapas-botao");
  var lista = document.getElementById("etapas-lista");
  function menu(aberto) {
    if (!botaoMenu || !lista) return;
    lista.hidden = !aberto;
    botaoMenu.setAttribute("aria-expanded", aberto ? "true" : "false");
  }
  if (botaoMenu && lista) {
    botaoMenu.addEventListener("click", function () { menu(lista.hidden); });
    lista.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); });
    document.addEventListener("click", function (e) {
      if (!lista.hidden && !e.target.closest(".etapas-menu")) menu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lista.hidden) { menu(false); botaoMenu.focus(); }
    });
  }

  // Etapas: a que cruza o meio da tela é a atual.
  var etapas = Array.prototype.slice.call(document.querySelectorAll("section.etapa[id]"));
  if (!etapas.length) return;
  var contador = document.getElementById("contador");
  var acao = document.getElementById("proxima");
  var atual = 0;
  var dois = function (n) { return (n < 10 ? "0" : "") + n; };

  function marcar(i) {
    atual = i;
    if (contador) contador.textContent = dois(i) + " / " + dois(etapas.length - 1);
    if (acao) {
      var ultima = i === etapas.length - 1;
      acao.querySelector("span").textContent = ultima ? "Voltar ao início" : "Próxima etapa";
      acao.querySelector("svg").innerHTML = ultima ? '<path d="m18 15-6-6-6 6"/>' : '<path d="m6 9 6 6 6-6"/>';
    }
  }

  var pendente = false;
  function conferir() {
    pendente = false;
    var meio = window.innerHeight / 2;
    for (var i = 0; i < etapas.length; i++) {
      var r = etapas[i].getBoundingClientRect();
      if (r.top <= meio && r.bottom > meio) {
        if (i !== atual) marcar(i);
        return;
      }
    }
  }
  window.addEventListener("scroll", function () {
    if (!pendente) { pendente = true; window.requestAnimationFrame(conferir); }
  }, { passive: true });
  conferir();

  if (acao) {
    acao.addEventListener("click", function () {
      var destino = atual === etapas.length - 1 ? etapas[0] : etapas[atual + 1];
      destino.scrollIntoView({ block: "start" });
      destino.focus({ preventScroll: true });
    });
  }
  etapas.forEach(function (e) { e.setAttribute("tabindex", "-1"); });
})();
