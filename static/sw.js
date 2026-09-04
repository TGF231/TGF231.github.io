/*
  Service worker de desmonte.

  O site anterior (Jekyll + tema Chirpy) tinha PWA ligado e registrou um
  service worker neste mesmo caminho (/sw.js). Um service worker registrado
  continua interceptando as requisições do visitante e respondendo do próprio
  cache mesmo depois do site inteiro ser trocado — o navegador nem chega a
  perguntar ao servidor. Apagar o arquivo do servidor não basta: quem já
  visitou o site antigo continua preso ao cache antigo.

  Este arquivo substitui aquele. Ele não faz cache de nada: assume o controle,
  apaga todos os caches, se desregistra e recarrega as abas abertas. Depois
  disso o navegador volta a buscar tudo na rede, normalmente.

  Não remova este arquivo tão cedo. Ele precisa continuar sendo servido até
  que os navegadores que visitaram o site antigo tenham passado por aqui.
*/
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((nome) => caches.delete(nome)));
      await self.registration.unregister();

      // Recarrega as abas que ainda estavam sob controle do worker antigo.
      const abas = await self.clients.matchAll({ type: "window" });
      for (const aba of abas) aba.navigate(aba.url);
    })()
  );
});
