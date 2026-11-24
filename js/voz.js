/* Requisio — gravação e transcrição com o reconhecimento de voz nativo do navegador */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const MENSAGENS = {
    'not-allowed': 'Permissão do microfone negada. Libere o microfone nas configurações do navegador.',
    'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz nesta página.',
    'audio-capture': 'Nenhum microfone encontrado, ou o microfone está em uso por outro programa.',
    'network': 'Falha de conexão: o reconhecimento de voz do navegador precisa de internet.',
    'no-speech': 'Nenhuma fala detectada. Tente novamente.',
    'language-not-supported': 'O reconhecimento de voz deste navegador não aceita português do Brasil.',
    'aborted': ''
  };

  const voz = {
    disponivel: !!SR,
    motivo: SR ? '' : 'Este navegador não oferece reconhecimento de voz. As respostas podem ser digitadas normalmente; para transcrever por voz, use Google Chrome ou Microsoft Edge.'
  };

  let atual = null;

  voz.ativoPara = (campoId) => !!atual && atual.campoId === campoId;

  /* Para a gravação. Os trechos já reconhecidos ainda chegam e são gravados no campo. */
  voz.parar = function () {
    if (!atual) return;
    atual.parando = true;
    try { atual.rec.stop(); } catch (e) { /* já parado */ }
  };

  /*
   * o = { campoId, path, aoTexto(campoId, path, texto, inicioSessao), aoEstado(campoId, situacao, mensagem) }
   */
  voz.iniciar = function (o) {
    if (!SR) return;
    if (atual) {
      // Uma gravação por vez: encerra a atual e inicia a próxima quando ela terminar.
      atual.proximo = o;
      voz.parar();
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;

    const sessao = { rec, campoId: o.campoId, inicio: true, erro: '', parando: false, proximo: null };

    rec.onstart = () => o.aoEstado(o.campoId, 'ouvindo', 'Ouvindo… clique em Parar ao terminar.');
    rec.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript.trim();
        if (!txt) continue;
        if (r.isFinal) {
          o.aoTexto(o.campoId, o.path, txt, sessao.inicio);
          sessao.inicio = false;
        } else {
          parcial += txt + ' ';
        }
      }
      if (!sessao.parando) o.aoEstado(o.campoId, 'ouvindo', parcial ? 'Ouvindo: ' + parcial.trim() : 'Ouvindo…');
    };
    rec.onerror = (e) => {
      sessao.erro = e.error in MENSAGENS ? MENSAGENS[e.error] : 'Erro no reconhecimento de voz (' + e.error + ').';
    };
    rec.onend = () => {
      if (atual === sessao) atual = null;
      o.aoEstado(o.campoId, sessao.erro ? 'erro' : 'parado', sessao.erro);
      if (sessao.proximo) voz.iniciar(sessao.proximo);
    };

    atual = sessao;
    try {
      rec.start();
    } catch (err) {
      atual = null;
      o.aoEstado(o.campoId, 'erro', 'Não foi possível iniciar a gravação: ' + err.message);
    }
  };

  R.voz = voz;
})();
