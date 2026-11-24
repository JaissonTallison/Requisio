/*
 * Requisio — estado, normalização e armazenamento no aparelho.
 * LocalStorage: cópia rápida do levantamento aberto.
 * IndexedDB: todos os levantamentos (lista), arquivos anexados e cópia confirmada no disco.
 */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  const CHAVE = 'requisio.levantamento';
  const CHAVE_BACKUP = 'requisio.backup';
  const CHAVE_CORROMPIDO = 'requisio.corrompido';
  const ORIGENS = ['cliente', 'pendente', 'inferencia', 'recomendacao'];
  const STATUS = ['a_validar', 'aprovado', 'rejeitado'];
  const VALIDACAO = ['pendente', 'aprovado', 'rejeitado', 'alteracoes'];
  const TIPOS_GRUPO = ['itens', 'cabecalho', 'diagrama', 'validacao', 'aprovacoes', 'assinatura', 'anexos'];
  /* Valores do formato anterior do diagnóstico */
  const ORIGEM_ANTIGA = { sugestao: 'recomendacao' };
  const STATUS_ANTIGO = { validado: 'aprovado', descartado: 'rejeitado' };

  R.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  function inicial() {
    const agora = new Date().toISOString();
    return {
      app: 'requisio',
      versao: 1,
      meta: { id: R.uid(), criadoEm: agora, atualizadoEm: agora, respostasAlteradasEm: '', autorizacaoGravacao: '' },
      etapaAtual: 'cadastro',
      cadastro: {
        empresa: '', fantasia: '', cnpj: '', ramo: '', porte: '', cidade: '', site: '',
        dataVisita: '', consultor: '', responsaveis: [], entrevistados: []
      },
      respostas: {},
      extras: {},
      departamentos: [],
      processos: [],
      diagnostico: null,
      validacao: {},
      anexos: []
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
      versao: Number(d.versao) || 1,
      geradoEm: str(d.geradoEm),
      secoes: comId(d.secoes).map((s) => ({
        id: idValido(s.id) ? s.id : R.uid(),
        titulo: str(s.titulo),
        nota: str(s.nota),
        anexo: !!s.anexo,
        grupos: comId(s.grupos).map((g) => {
          const grupo = {
            id: idValido(g.id) ? g.id : R.uid(),
            titulo: str(g.titulo),
            nota: str(g.nota),
            prefixo: str(g.prefixo),
            comStatus: !!g.comStatus,
            tipo: TIPOS_GRUPO.includes(g.tipo) ? g.tipo : 'itens',
            nivel: g.nivel === 4 ? 4 : 3,
            itens: comId(g.itens).map((i) => {
              const origem = ORIGEM_ANTIGA[i.origem] || i.origem;
              const item = {
                id: idValido(i.id) ? i.id : R.uid(),
                texto: str(i.texto),
                origem: ORIGENS.includes(origem) ? origem : 'cliente',
                fonte: str(i.fonte)
              };
              if (g.comStatus) {
                const st = STATUS_ANTIGO[i.status] || i.status;
                item.status = STATUS.includes(st) ? st : 'a_validar';
              }
              return item;
            })
          };
          if (grupo.tipo === 'diagrama') { grupo.codigo = str(g.codigo); grupo.preliminar = !!g.preliminar; }
          if (grupo.tipo === 'validacao') grupo.chave = idValido(g.chave) ? g.chave : 'geral';
          if (grupo.tipo === 'aprovacoes') {
            grupo.chaves = Array.isArray(g.chaves) ? g.chaves.filter(idValido) : [];
            grupo.nomes = Array.isArray(g.nomes) ? g.nomes.map(str) : [];
          }
          return grupo;
        })
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
    if (!idValido(b.meta.id)) b.meta.id = R.uid();
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
    b.anexos = lista(o.anexos);
    const val = obj(o.validacao);
    Object.keys(val).forEach((k) => {
      if (!idValido(k)) return;
      const v = obj(val[k]);
      b.validacao[k] = { status: VALIDACAO.includes(v.status) ? v.status : 'pendente', comentario: str(v.comentario), data: str(v.data), versao: str(v.versao) };
    });
    return b;
  }

  const CHAVE_ANTERIOR = 'requisio.anterior';
  const CHAVE_MARCA = 'requisio.marca';

  function lerLocal(chave) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? normalizar(JSON.parse(bruto)) : null;
    } catch (e) {
      return null;
    }
  }

  /* Carrega o levantamento aberto. Se a cópia principal estiver ilegível, usa a versão anterior. */
  function carregar() {
    let bruto = null;
    try {
      bruto = localStorage.getItem(CHAVE);
      if (bruto) return normalizar(JSON.parse(bruto));
    } catch (e) {
      R.erroCarregar = e;
      // Guarda o conteúdo ilegível para não sobrescrevê-lo sem rastro.
      try { if (bruto) localStorage.setItem(CHAVE_CORROMPIDO, bruto); } catch (e2) { /* sem espaço */ }
      const anterior = lerLocal(CHAVE_ANTERIOR);
      if (anterior) { R.recuperadoDe = 'anterior'; return anterior; }
    }
    return inicial();
  }

  /* ---------- IndexedDB ---------- */
  let dbp = null;
  function abrirDB() {
    if (dbp) return dbp;
    dbp = new Promise((ok, falha) => {
      if (!window.indexedDB) { falha(new Error('IndexedDB indisponível')); return; }
      const r = indexedDB.open('requisio', 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        ['dados', 'levantamentos', 'arquivos'].forEach((n) => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n); });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
      r.onblocked = () => falha(new Error('IndexedDB bloqueado'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  /* Escrita com confirmação em disco ("strict"), para resistir a desligamento brusco. */
  function idbPut(store, chave, valor) {
    return abrirDB().then((db) => new Promise((ok, falha) => {
      let tx;
      try { tx = db.transaction(store, 'readwrite', { durability: 'strict' }); } catch (e) { tx = db.transaction(store, 'readwrite'); }
      tx.objectStore(store).put(valor, chave);
      tx.oncomplete = () => ok(true);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error || new Error('gravação cancelada'));
    }));
  }
  function idbGet(store, chave) {
    return abrirDB().then((db) => new Promise((ok, falha) => {
      const r = db.transaction(store, 'readonly').objectStore(store).get(chave);
      r.onsuccess = () => ok(r.result === undefined ? null : r.result);
      r.onerror = () => falha(r.error);
    }));
  }
  function idbDel(store, chave) {
    return abrirDB().then((db) => new Promise((ok, falha) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(chave);
      tx.oncomplete = () => ok(true);
      tx.onerror = () => falha(tx.error);
    }));
  }
  function idbTodos(store) {
    return abrirDB().then((db) => new Promise((ok, falha) => {
      const os = db.transaction(store, 'readonly').objectStore(store);
      const rv = os.getAll();
      const rk = os.getAllKeys();
      rv.onerror = () => falha(rv.error);
      os.transaction.oncomplete = () => ok(rk.result.map((k, i) => ({ chave: k, valor: rv.result[i] })));
      os.transaction.onerror = () => falha(os.transaction.error);
    }));
  }

  let timerEspelho = null;
  let pendenteEspelho = null;
  function espelhar(estado, json, imediato) {
    pendenteEspelho = { id: estado.meta.id, json };
    clearTimeout(timerEspelho);
    const gravar = () => {
      const p = pendenteEspelho;
      pendenteEspelho = null;
      if (!p) return Promise.resolve(true);
      return idbPut('levantamentos', p.id, p.json).catch(() => false);
    };
    if (imediato) return gravar();
    timerEspelho = setTimeout(gravar, 250);
    return null;
  }

  let ultimaAnterior = 0;
  /*
   * Salva o levantamento aberto: LocalStorage (rápido), versão anterior a cada minuto
   * e IndexedDB (lista de levantamentos, com confirmação em disco).
   * Retorna true se a cópia rápida foi gravada.
   */
  function salvar(estado, aba, imediato) {
    const json = JSON.stringify(estado);
    let ok = false;
    try {
      if (Date.now() - ultimaAnterior > 60000) {
        const atual = localStorage.getItem(CHAVE);
        if (atual && atual !== json) localStorage.setItem(CHAVE_ANTERIOR, atual);
        ultimaAnterior = Date.now();
      }
    } catch (e) { /* sem espaço para a versão anterior: segue com a principal */ }
    try {
      // A marca vem antes: quando as outras abas forem avisadas, ela já está atualizada.
      localStorage.setItem(CHAVE_MARCA, JSON.stringify({ em: estado.meta.atualizadoEm, aba: aba || '', id: estado.meta.id }));
      localStorage.setItem(CHAVE, json);
      ok = true;
    } catch (e) { /* cheio ou bloqueado: a cópia no IndexedDB continua valendo */ }
    espelhar(estado, json, imediato || !ok);
    return ok;
  }

  /* Última gravação feita por qualquer aba: { em, aba, id }. */
  function marca() {
    try { return JSON.parse(localStorage.getItem(CHAVE_MARCA) || 'null'); } catch (e) { return null; }
  }

  function parse(json) {
    try { return normalizar(typeof json === 'string' ? JSON.parse(json) : json); } catch (e) { return null; }
  }

  /*
   * Procura uma cópia mais recente que a carregada: no IndexedDB (mesmo levantamento),
   * no espelho antigo ou na versão anterior. Sem nada salvo no LocalStorage, pega o
   * levantamento mais recente do IndexedDB.
   */
  function recuperarMaisRecente(atual, temSalvo) {
    const ref = temSalvo ? ((atual && atual.meta && atual.meta.atualizadoEm) || '') : '';
    const candidatos = [];
    const anterior = lerLocal(CHAVE_ANTERIOR);
    if (anterior && (!temSalvo || anterior.meta.id === atual.meta.id)) candidatos.push({ estado: anterior, origem: 'anterior' });
    const doIdb = temSalvo
      ? idbGet('levantamentos', atual.meta.id).then((j) => (j ? [j] : []))
      : idbTodos('levantamentos').then((l) => l.map((x) => x.valor));
    return doIdb.catch(() => [])
      .then((lista) => idbGet('dados', 'levantamento').catch(() => null).then((velho) => (velho && !temSalvo ? lista.concat([velho]) : lista)))
      .then((lista) => {
        lista.forEach((j) => { const e = parse(j); if (e) candidatos.push({ estado: e, origem: 'espelho' }); });
        return candidatos.filter((c) => c.estado.meta.atualizadoEm > ref)
          .sort((a, b) => (a.estado.meta.atualizadoEm < b.estado.meta.atualizadoEm ? 1 : -1))[0] || null;
      });
  }

  /* ---------- Lista de levantamentos ---------- */
  function resumoDe(e) {
    const respondidas = Object.values(e.respostas).filter((r) => r && typeof r.texto === 'string' && r.texto.trim()).length;
    return {
      id: e.meta.id, empresa: e.cadastro.empresa, fantasia: e.cadastro.fantasia, dataVisita: e.cadastro.dataVisita,
      criadoEm: e.meta.criadoEm, atualizadoEm: e.meta.atualizadoEm, respondidas,
      relatorio: e.diagnostico ? e.diagnostico.geradoEm : '', anexos: (e.anexos || []).length
    };
  }

  /* Todos os levantamentos guardados, do mais recente para o mais antigo. */
  function listar(atual) {
    return idbTodos('levantamentos').catch(() => []).then((l) => {
      const mapa = {};
      l.forEach((x) => { const e = parse(x.valor); if (e) mapa[e.meta.id] = resumoDe(e); });
      if (atual) mapa[atual.meta.id] = resumoDe(atual);
      return Object.values(mapa).sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
    });
  }

  function abrir(id) {
    return idbGet('levantamentos', id).then((j) => parse(j));
  }

  /* Grava um levantamento na lista sem abri-lo (importação, por exemplo). */
  function guardar(estado) {
    return idbPut('levantamentos', estado.meta.id, JSON.stringify(estado));
  }

  function existeNaLista(id) {
    return idbGet('levantamentos', id).then((j) => !!j).catch(() => false);
  }

  /* Exclui o levantamento e os arquivos anexados a ele. */
  function excluir(id) {
    return abrir(id).then((e) => Promise.all(((e && e.anexos) || []).map((a) => idbDel('arquivos', a.id).catch(() => false))))
      .then(() => idbDel('levantamentos', id));
  }

  /* ---------- Arquivos anexados (fotos e documentos) ---------- */
  const salvarArquivo = (id, blob) => idbPut('arquivos', id, blob);
  const lerArquivo = (id) => idbGet('arquivos', id);
  const excluirArquivo = (id) => idbDel('arquivos', id);

  /* Pede ao navegador para não apagar os dados quando faltar espaço (quando suportado). */
  function pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) { /* sem suporte */ }
  }

  /* Cópia de segurança antes de importar ou iniciar outro levantamento. */
  function backup(estado) {
    try { localStorage.setItem(CHAVE_BACKUP, JSON.stringify(estado)); } catch (e) { /* ignora */ }
  }

  function existeSalvo() {
    try { return !!localStorage.getItem(CHAVE); } catch (e) { return false; }
  }

  function guardarConflito(estado) {
    try { localStorage.setItem('requisio.conflito', JSON.stringify(estado)); } catch (e) { /* ignora */ }
    idbPut('dados', 'conflito_' + estado.meta.id, JSON.stringify(estado)).catch(() => {});
  }

  R.armazenamento = {
    CHAVE, CHAVE_MARCA, inicial, normalizar, carregar, salvar, backup, existeSalvo, marca, lerLocal, recuperarMaisRecente,
    pedirPersistencia, guardarConflito, listar, abrir, guardar, existeNaLista, excluir, salvarArquivo, lerArquivo, excluirArquivo
  };
})();
