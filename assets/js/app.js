// Etapas da página: contador e nome da etapa na barra de título, menu Etapas,
// a ação primária "Próxima etapa" e o modo retrato do MegUI. Sem dependências.
(function () {
  "use strict";

  var janela = document.getElementById("janela");
  var rolavel = document.getElementById("main");

  // Retrato: abaixo de --megui-virada ou mais alto que largo, o que vier primeiro.
  var virada = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--megui-virada"), 10) || 0;
  var acao = document.getElementById("proxima");
  if (virada && janela) {
    var retrato = window.matchMedia("(max-width: " + (virada - 1) + "px), (max-aspect-ratio: 1/1)");
    var aplicarRetrato = function () {
      janela.classList.toggle("retrato", retrato.matches);
      if (acao) acao.classList.toggle("mg-acao-primaria--retrato", retrato.matches);
    };
    aplicarRetrato();
    retrato.addEventListener("change", aplicarRetrato);
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

  // Etapas: a que ocupa o meio da tela é a atual.
  var etapas = Array.prototype.slice.call(document.querySelectorAll("section.etapa[id]"));
  if (!etapas.length || !rolavel) return;
  var contador = document.getElementById("contador");
  var contexto = document.getElementById("contexto");
  var atual = 0;
  var dois = function (n) { return (n < 10 ? "0" : "") + n; };

  function marcar(i) {
    atual = i;
    if (contador) contador.textContent = dois(i) + " / " + dois(etapas.length - 1);
    if (contexto) contexto.textContent = etapas[i].getAttribute("data-titulo") || "";
    if (acao) {
      var ultima = i === etapas.length - 1;
      acao.querySelector("span").textContent = ultima ? "Voltar ao início" : "Próxima etapa";
      acao.querySelector("svg").innerHTML = ultima ? '<path d="m18 15-6-6-6 6"/>' : '<path d="m6 9 6 6 6-6"/>';
    }
  }

  // A cada rolagem (no máximo uma vez por quadro), procura a etapa que cruza o meio da área rolável.
  var pendente = false;
  function conferir() {
    pendente = false;
    var caixa = rolavel.getBoundingClientRect();
    var meio = caixa.top + caixa.height / 2;
    for (var i = 0; i < etapas.length; i++) {
      var r = etapas[i].getBoundingClientRect();
      if (r.top <= meio && r.bottom > meio) {
        if (i !== atual) marcar(i);
        return;
      }
    }
  }
  rolavel.addEventListener("scroll", function () {
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

  // Foco vai para a etapa escolhida, para o leitor de tela acompanhar.
  etapas.forEach(function (e) { e.setAttribute("tabindex", "-1"); });
})();
