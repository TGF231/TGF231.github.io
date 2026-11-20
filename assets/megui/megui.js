/* MegUI — ajudante sem framework (HTML puro, Django, Tauri sem React). Opcional.
   <script src="megui.js" defer></script> e pronto:
   - [data-href] em linha de tabela, aba de planilha etc. navega no clique e no Enter;
   - [role="tab"] e [role="menuitem"] respondem a Enter/Espaço;
   - MegUI.aplicarTema('escuro' | 'claro' | undefined) troca o tema (data-theme e data-tema). */
(function () {
  function aplicarTema(tema, el) {
    el = el || document.documentElement;
    if (tema) { el.setAttribute('data-theme', tema); el.setAttribute('data-tema', tema); }
    else { el.removeAttribute('data-theme'); el.removeAttribute('data-tema'); }
  }
  document.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-href]');
    if (alvo && !alvo.disabled && !e.target.closest('a, button:not([data-href]), input, select, label')) window.location.href = alvo.getAttribute('data-href');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var alvo = e.target.closest('[data-href], [role="tab"], [role="menuitem"]');
    if (alvo && alvo === e.target && alvo.tagName !== 'BUTTON' && alvo.tagName !== 'A') { e.preventDefault(); alvo.click(); }
  });
  window.MegUI = Object.assign(window.MegUI || {}, { aplicarTema: aplicarTema });
})();
