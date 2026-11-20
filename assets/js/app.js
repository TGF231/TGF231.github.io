// Troca de tema claro e escuro, lembrada neste navegador. Sem escolha salva, segue o
// sistema. Sem dependências.
(function () {
  "use strict";

  var raiz = document.documentElement;
  var botaoTema = document.getElementById("tema");
  if (!botaoTema) return;

  botaoTema.addEventListener("click", function () {
    var atual = raiz.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro");
    var novo = atual === "claro" ? "escuro" : "claro";
    raiz.setAttribute("data-theme", novo);
    try { localStorage.setItem("tema", novo); } catch (e) { /* armazenamento bloqueado: vale só nesta visita */ }
  });
})();
