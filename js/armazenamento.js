/* Requisio — estado inicial, normalização e salvamento no LocalStorage */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  const CHAVE = 'requisio.levantamento';
  const CHAVE_BACKUP = 'requisio.backup';
  const CHAVE_CORROMPIDO = 'requisio.corrompido';
  const ORIGENS = ['cliente', 'sugestao', 'pendente'];
  const STATUS = ['a_validar', 'validado', 'descartado'];

  R.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  function inicial() {
    const agora = new Date().toISOString();
    return {
      app: 'requisio',
      versao: 1,
      meta: { criadoEm: agora, atualizadoEm: agora, respostasAlteradasEm: '', autorizacaoGravacao: '' },
      etapaAtual: 'cadastro',
      cadastro: {
        empresa: '', fantasia: '', cnpj: '', ramo: '', porte: '', cidade: '', site: '',
        dataVisita: '', consultor: '', responsaveis: [], entrevistados: []
      },
      respostas: {},
      extras: {},
      departamentos: [],
      processos: [],
      diagnostico: null
    };
  }

  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const idValido = (v) => typeof v === 'string' && /^[a-z0-9_]+$/i.test(v);

  /* Garante que todo item de lista tenha id e que textos sejam strings. */
  function lista(v) {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const novo = { id: idValido(x.id) ? x.id : R.uid() };
        Object.keys(x).forEach((k) => {
          if (k === 'id') return;
          novo[k] = typeof x[k] === 'boolean' ? x[k] : str(x[k]);
        });
        return novo;
      });
  }

  function normalizarDiagnostico(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.secoes)) return null;
    const comId = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
    return {
      geradoEm: str(d.geradoEm),
      secoes: comId(d.secoes).map((s) => ({
        id: idValido(s.id) ? s.id : R.uid(),
        titulo: str(s.titulo),
        nota: str(s.nota),
        grupos: comId(s.grupos).map((g) => ({
          id: idValido(g.id) ? g.id : R.uid(),
          titulo: str(g.titulo),
          nota: str(g.nota),
          prefixo: str(g.prefixo),
          comStatus: !!g.comStatus,
          itens: comId(g.itens).map((i) => {
            const item = {
              id: idValido(i.id) ? i.id : R.uid(),
              texto: str(i.texto),
              origem: ORIGENS.includes(i.origem) ? i.origem : 'cliente',
              fonte: str(i.fonte)
            };
            if (g.comStatus) item.status = STATUS.includes(i.status) ? i.status : 'a_validar';
            return item;
          })
        }))
      }))
    };
  }

  function normalizar(o) {
    if (!o || typeof o !== 'object' || o.app !== 'requisio') {
      throw new Error('O arquivo não é um levantamento do Requisio.');
    }
    const b = inicial();
    const meta = obj(o.meta);
    Object.keys(b.meta).forEach((k) => { if (k in meta) b.meta[k] = str(meta[k]); });
    b.etapaAtual = str(o.etapaAtual) || 'cadastro';

    const c = obj(o.cadastro);
    Object.keys(b.cadastro).forEach((k) => {
      b.cadastro[k] = k === 'responsaveis' || k === 'entrevistados' ? lista(c[k]) : str(c[k]);
    });

    const r = obj(o.respostas);
    Object.keys(r).forEach((k) => {
      const v = obj(r[k]);
      b.respostas[k] = { texto: str(v.texto), confirmar: !!v.confirmar };
    });

    const ex = obj(o.extras);
    Object.keys(ex).forEach((k) => { b.extras[k] = lista(ex[k]); });

    b.departamentos = lista(o.departamentos);
    b.processos = lista(o.processos);
    b.diagnostico = normalizarDiagnostico(o.diagnostico);
    return b;
  }

  function carregar() {
    let bruto = null;
    try {
      bruto = localStorage.getItem(CHAVE);
      if (bruto) return normalizar(JSON.parse(bruto));
    } catch (e) {
      R.erroCarregar = e;
      // Guarda o conteúdo ilegível para não sobrescrevê-lo sem rastro.
      try { if (bruto) localStorage.setItem(CHAVE_CORROMPIDO, bruto); } catch (e2) { /* sem espaço */ }
    }
    return inicial();
  }

  function salvar(estado) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Cópia de segurança antes de importar ou iniciar outro levantamento. */
  function backup(estado) {
    try { localStorage.setItem(CHAVE_BACKUP, JSON.stringify(estado)); } catch (e) { /* ignora */ }
  }

  function existeSalvo() {
    try { return !!localStorage.getItem(CHAVE); } catch (e) { return false; }
  }

  R.armazenamento = { inicial, normalizar, carregar, salvar, backup, existeSalvo };
})();
