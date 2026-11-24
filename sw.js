/*
 * Requisio — service worker.
 * Rede primeiro (sempre pega a versão nova quando há internet) e, sem internet,
 * usa a cópia guardada. Assim o Requisio abre e funciona offline depois da primeira visita.
 * Os dados do levantamento não passam por aqui: ficam no armazenamento do navegador.
 */
const CACHE = 'requisio-v1';
const ARQUIVOS = [
  './', 'index.html', 'css/estilos.css',
  'js/armazenamento.js', 'js/etapas.js', 'js/voz.js', 'js/analise.js',
  'js/diagramas.js', 'js/relatorio.js', 'js/app.js'
];
const ESPERA_REDE_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function comPrazo(promessa, ms) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('tempo esgotado')), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); falha(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const navegacao = req.mode === 'navigate';
  e.respondWith(
    (navegacao ? comPrazo(fetch(req), ESPERA_REDE_MS) : fetch(req))
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(navegacao ? 'index.html' : req, copia));
        }
        return res;
      })
      .catch(() => caches.match(navegacao ? 'index.html' : req, { ignoreSearch: true })
        .then((r) => r || caches.match(req, { ignoreSearch: true }))
        .then((r) => r || Response.error()))
  );
});
