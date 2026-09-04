// Filtro da grade de repositórios. Sem dependências.
// O design é dark-only por definição, então não há alternador de tema.
(function () {
  "use strict";

  var grid = document.getElementById("repo-grid");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".repo-card"));
  var q = document.getElementById("q");
  var lang = document.getElementById("lang");
  var onlyPages = document.getElementById("only-pages");
  var noResults = document.getElementById("no-results");

  function apply() {
    var term = ((q && q.value) || "").trim().toLowerCase();
    var wantLang = (lang && lang.value) || "";
    var pagesOnly = Boolean(onlyPages && onlyPages.checked);
    var visible = 0;

    cards.forEach(function (card) {
      var haystack = card.dataset.name + " " + card.dataset.topics + " " + card.textContent.toLowerCase();
      var ok =
        (!term || haystack.indexOf(term) !== -1) &&
        (!wantLang || card.dataset.lang === wantLang) &&
        (!pagesOnly || card.dataset.pages === "1");
      card.hidden = !ok;
      if (ok) visible++;
    });

    if (noResults) noResults.hidden = visible !== 0;
  }

  [q, lang, onlyPages].forEach(function (el) {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  // Permite chegar filtrado por URL: /?q=backup&lang=python
  var params = new URLSearchParams(location.search);
  if (q && params.get("q")) q.value = params.get("q");
  if (lang && params.get("lang")) lang.value = params.get("lang").toLowerCase();
  apply();
})();
