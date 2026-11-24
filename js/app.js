/* Requisio — interface, navegação, salvamento automático, importação e exportação */
(function () {
  'use strict';
  const R = window.Requisio;
  const A = R.armazenamento;

  let estado = A.carregar();
  let visao = null; // 'lista' = tela de levantamentos salvos

  const principal = document.getElementById('principal');
  const nav = document.getElementById('navEtapas');
  const statusSalvo = document.getElementById('statusSalvo');
  const topoEmpresa = document.getElementById('topoEmpresa');
  const arquivoImportar = document.getElementById('arquivoImportar');
  const dlgGravacao = document.getElementById('dlgGravacao');

  const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ENT[c]);
  const temTexto = (v) => typeof v === 'string' && v.trim() !== '';
  const etapaPorId = (id) => R.ETAPAS.find((e) => e.id === id);

  const ICONE_MIC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

  /* Edição de texto puro nos itens do diagnóstico (com alternativa para navegadores antigos). */
  const EDITAVEL = (() => {
    try { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; } catch (e) { return 'true'; }
  })();

  const ORIGENS = { cliente: 'Informado pelo cliente', pendente: 'Pendente de confirmação', inferencia: 'Inferência do sistema', recomendacao: 'Recomendação técnica' };
  const STATUS = { a_validar: 'A validar', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };
  const VALIDACAO = { pendente: 'Pendente de decisão', aprovado: 'Aprovada', alteracoes: 'Alterações solicitadas', rejeitado: 'Rejeitada' };

  /* ================= Salvamento automático ================= */
  let timerSalvar = null;
  let sujo = false;

  function hora(d) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

  function mostrarStatus(txt, erro) {
    statusSalvo.textContent = txt;
    statusSalvo.title = txt;
    statusSalvo.classList.toggle('erro', !!erro);
  }

  const ABA = R.uid();
  let baseSalva = estado.meta.atualizadoEm || '';

  function agendarSalvar() {
    sujo = true;
    estado.meta.atualizadoEm = new Date().toISOString();
    mostrarStatus('Salvando…');
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(salvarAgora, 150);
  }

  /* Outra aba (ou esta aba reaberta) gravou depois da última sincronização? */
  function outraAbaGravouDepois() {
    const m = A.marca();
    return !!(m && m.aba && m.aba !== ABA && m.em > baseSalva);
  }

  function salvarAgora(imediato) {
    clearTimeout(timerSalvar);
    if (!sujo) return;
    if (outraAbaGravouDepois()) {
      // Esta aba estava desatualizada: guarda a versão dela à parte e carrega a mais recente.
      A.guardarConflito(estado);
      sujo = false;
      adotarArmazenado('Este levantamento foi alterado em outra aba ou aparelho aberto aqui. Os dados mais recentes foram carregados; a versão desta aba ficou guardada como cópia.');
      return;
    }
    const ok = A.salvar(estado, ABA, imediato === true);
    sujo = false;
    baseSalva = estado.meta.atualizadoEm;
    if (ok) mostrarStatus('Salvo neste aparelho às ' + hora(new Date()));
    else mostrarStatus('Armazenamento principal cheio ou bloqueado: os dados estão na cópia de segurança do navegador. Exporte o JSON para garantir.', true);
  }

  /* Carrega o que está gravado (feito por outra aba) e redesenha a tela. */
  function adotarArmazenado(msg) {
    const novo = A.lerLocal(A.CHAVE);
    if (!novo) return false;
    R.voz.parar();
    estado = novo;
    baseSalva = estado.meta.atualizadoEm || '';
    render();
    if (msg) mostrarStatus(msg, true);
    return true;
  }

  const salvarJa = () => salvarAgora(true);
  window.addEventListener('pagehide', salvarJa);
  window.addEventListener('beforeunload', salvarJa);
  document.addEventListener('freeze', salvarJa);
  document.addEventListener('focusout', () => salvarAgora());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') salvarJa();
    else verificarAtualizacaoExterna();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) verificarAtualizacaoExterna(); });

  /* Ao voltar para a aba: se outra aba gravou algo mais novo, carrega antes de continuar. */
  function verificarAtualizacaoExterna() {
    if (sujo) return;
    const m = A.marca();
    if (m && m.aba !== ABA && m.em > (estado.meta.atualizadoEm || '')) adotarArmazenado('Dados atualizados com as alterações feitas em outra aba.');
  }

  /* Outra aba gravou: mantém esta aba igual, para nenhuma gravar por cima da outra. */
  window.addEventListener('storage', (e) => {
    if (e.key !== A.CHAVE || !e.newValue) return;
    if (sujo) salvarAgora();
    const m = A.marca();
    if (m && m.aba !== ABA && m.em > (estado.meta.atualizadoEm || '')) adotarArmazenado('Dados atualizados com as alterações feitas em outra aba.');
  });

  window.addEventListener('offline', () => mostrarStatus('Sem internet. O preenchimento continua sendo salvo neste aparelho; a gravação por voz volta com a conexão.', true));
  window.addEventListener('online', () => mostrarStatus('Conexão restabelecida. Dados salvos neste aparelho.'));

  /* ================= Caminhos no estado =================
     "cadastro.empresa", "respostas.emp_atividade.texto", "departamentos.#id.nome" */
  function passo(atual, seg, criar) {
    if (atual == null) return undefined;
    if (seg[0] === '#') return Array.isArray(atual) ? atual.find((x) => x.id === seg.slice(1)) : undefined;
    if (atual[seg] === undefined && criar) atual[seg] = {};
    return atual[seg];
  }

  function obter(caminho) {
    return caminho.split('.').reduce((a, s) => passo(a, s, false), estado);
  }

  function definir(caminho, valor) {
    const p = caminho.split('.');
    let atual = estado;
    for (let i = 0; i < p.length - 1; i++) {
      atual = passo(atual, p[i], true);
      if (atual == null || typeof atual !== 'object') return false;
    }
    atual[p[p.length - 1]] = valor;
    return true;
  }

  function marcarRespostaAlterada(caminho) {
    if (!caminho.startsWith('diagnostico') && !caminho.startsWith('validacao')) estado.meta.respostasAlteradasEm = new Date().toISOString();
  }

  /* ================= Progresso ================= */
  function progressoEtapa(et) {
    if (et.tipo === 'diagnostico') return null;
    if (et.tipo === 'cadastro') {
      const c = estado.cadastro;
      const itens = [temTexto(c.empresa), temTexto(c.ramo), temTexto(c.porte),
        c.responsaveis.some((p) => temTexto(p.nome)), c.entrevistados.some((p) => temTexto(p.nome))];
      return { feitas: itens.filter(Boolean).length, total: itens.length };
    }
    let total = 0, feitas = 0;
    if (et.lista) { total++; if (estado[et.lista].some((x) => temTexto(x.nome))) feitas++; }
    et.perguntas.filter((p) => R.perguntaVisivel(p, estado)).forEach((p) => { total++; if (temTexto(estado.respostas[p.id] && estado.respostas[p.id].texto)) feitas++; });
    (estado.extras[et.id] || []).forEach((x) => { if (!temTexto(x.pergunta)) return; total++; if (temTexto(x.resposta)) feitas++; });
    return { feitas, total };
  }

  function progressoGeral() {
    let feitas = 0, total = 0;
    R.ETAPAS.forEach((e) => { const p = progressoEtapa(e); if (p) { feitas += p.feitas; total += p.total; } });
    return { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 };
  }

  function textoDiag() {
    if (!estado.diagnostico) return 'não gerado';
    return diagDesatualizado() ? 'desatualizado' : 'gerado';
  }

  function diagDesatualizado() {
    const d = estado.diagnostico;
    return !!(d && estado.meta.respostasAlteradasEm && estado.meta.respostasAlteradasEm > d.geradoEm);
  }

  let timerProg = null;
  function agendarProgresso() { clearTimeout(timerProg); timerProg = setTimeout(atualizarProgresso, 250); }

  function atualizarProgresso() {
    R.ETAPAS.forEach((e) => {
      const el = nav.querySelector('[data-cont="' + e.id + '"]');
      if (!el) return;
      const p = progressoEtapa(e);
      el.textContent = p ? p.feitas + '/' + p.total : textoDiag();
    });
    const g = progressoGeral();
    const tot = document.getElementById('progTotal');
    if (tot) tot.textContent = g.feitas + ' de ' + g.total + ' respondidas · ' + g.pct + '%';
    const et = etapaPorId(estado.etapaAtual);
    const pe = document.getElementById('progEtapa');
    if (pe && et) { const p = progressoEtapa(et); if (p) pe.textContent = p.feitas + ' de ' + p.total + ' respondidas'; }
  }

  function atualizarTopo() {
    topoEmpresa.textContent = temTexto(estado.cadastro.empresa) ? estado.cadastro.empresa : 'Empresa não informada';
  }

  /* ================= Renderização ================= */
  function render(rolarTopo) {
    R.voz.parar();
    renderNav();
    renderPrincipal();
    atualizarTopo();
    if (rolarTopo) window.scrollTo(0, 0);
  }

  function renderNav() {
    const g = progressoGeral();
    nav.innerHTML =
      '<div class="nav-prog"><span>Progresso da entrevista</span><strong id="progTotal">' + g.feitas + ' de ' + g.total + ' respondidas · ' + g.pct + '%</strong></div>' +
      '<ol class="nav-lista">' + R.ETAPAS.map((e, i) => {
        const p = progressoEtapa(e);
        const ativo = visao !== 'lista' && e.id === estado.etapaAtual;
        return '<li><button type="button" class="nav-item' + (ativo ? ' ativo' : '') + '" data-acao="ir" data-etapa="' + e.id + '"' + (ativo ? ' aria-current="step"' : '') + '>' +
          '<span class="nav-num">' + (i + 1) + '</span><span class="nav-nome">' + esc(e.titulo) + '</span>' +
          '<span class="nav-cont" data-cont="' + e.id + '">' + (p ? p.feitas + '/' + p.total : textoDiag()) + '</span></button></li>';
      }).join('') + '</ol>';
  }

  function renderPrincipal() {
    if (visao === 'lista') { renderLevantamentos(); return; }
    let et = etapaPorId(estado.etapaAtual);
    if (!et) { et = R.ETAPAS[0]; estado.etapaAtual = et.id; }
    let corpo;
    if (et.tipo === 'cadastro') corpo = renderCadastro();
    else if (et.tipo === 'diagnostico') corpo = renderDiagnostico();
    else corpo = renderPerguntas(et);
    principal.innerHTML = cabecalho(et) + corpo + rodape(et);
    principal.querySelectorAll('textarea.resposta').forEach(ajustarAltura);
    if (et.tipo === 'diagnostico') R.diagramas.desenhar(principal);
    carregarAnexosVisiveis();
  }

  function cabecalho(et) {
    const idx = R.ETAPAS.indexOf(et);
    const p = progressoEtapa(et);
    const seletor = '<div class="seletor-etapa nao-imprimir"><label for="selEtapa">Etapa</label><select id="selEtapa">' +
      R.ETAPAS.map((e, i) => '<option value="' + e.id + '"' + (e.id === et.id ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(e.titulo) + '</option>').join('') +
      '</select>' +
      '<button type="button" class="btn btn-sec" aria-label="Etapa anterior" title="Etapa anterior"' + (idx > 0 ? ' data-acao="ir" data-etapa="' + R.ETAPAS[idx - 1].id + '"' : ' disabled') + '>‹</button>' +
      '<button type="button" class="btn btn-sec" aria-label="Próxima etapa" title="Próxima etapa"' + (idx < R.ETAPAS.length - 1 ? ' data-acao="ir" data-etapa="' + R.ETAPAS[idx + 1].id + '"' : ' disabled') + '>›</button></div>';
    let dir = '';
    if (p) dir = '<span class="pag-prog" id="progEtapa">' + p.feitas + ' de ' + p.total + ' respondidas</span>';
    if (et.tipo === 'diagnostico' && estado.diagnostico) {
      dir = '<button type="button" class="btn btn-sec" data-acao="gerar">Gerar novamente</button>' +
        '<button type="button" class="btn btn-pri" data-acao="imprimir">Imprimir ou salvar PDF</button>';
    }
    const aviso = !R.voz.disponivel && et.perguntas ? '<p class="aviso nao-imprimir">' + esc(R.voz.motivo) + '</p>' : '';
    return seletor + '<div class="pag-cab nao-imprimir"><div><h1>' + (idx + 1) + '. ' + esc(et.titulo) + '</h1><p class="pag-desc">' + esc(et.desc) + '</p></div>' +
      '<div class="pag-cab-dir">' + dir + '</div></div>' + aviso;
  }

  function rodape(et) {
    const idx = R.ETAPAS.indexOf(et);
    const ant = idx > 0 ? '<button type="button" class="btn btn-sec" data-acao="ir" data-etapa="' + R.ETAPAS[idx - 1].id + '">Anterior: ' + esc(R.ETAPAS[idx - 1].titulo) + '</button>' : '<span></span>';
    let prox = '';
    if (et.id === 'sol') prox = '<button type="button" class="btn btn-pri" data-acao="finalizar">Finalizar e gerar relatório</button>';
    else if (idx < R.ETAPAS.length - 1) prox = '<button type="button" class="btn btn-pri" data-acao="ir" data-etapa="' + R.ETAPAS[idx + 1].id + '">Próxima: ' + esc(R.ETAPAS[idx + 1].titulo) + '</button>';
    return '<div class="pag-rodape nao-imprimir">' + ant + prox + '</div>';
  }

  function botaoVoz(id) {
    if (!R.voz.disponivel) return '<button type="button" class="btn-voz" disabled title="Reconhecimento de voz indisponível neste navegador">' + ICONE_MIC + '<span>Gravar</span></button>';
    const ativo = R.voz.ativoPara(id);
    return '<button type="button" class="btn-voz' + (ativo ? ' gravando' : '') + '" data-acao="voz" data-alvo="' + id + '" aria-pressed="' + ativo + '">' + ICONE_MIC + '<span>' + (ativo ? 'Parar' : 'Gravar') + '</span></button>';
  }

  /* Exemplos de resposta, discretos: ajudam o entrevistador a orientar o entrevistado. Tocar insere no campo. */
  function linhaExemplos(id, exemplos) {
    if (!exemplos || !exemplos.length) return '';
    return '<p class="exemplos nao-imprimir"><span class="exemplos-rot">Exemplos:</span> ' + exemplos.map((x) =>
      '<a href="#" role="button" class="exemplo" data-acao="exemplo" data-alvo="' + id + '" data-texto="' + esc(x) + '" title="Inserir no campo">' + esc(x.replace(/\n/g, ' ')) + '</a>'
    ).join('<span class="exemplos-sep" aria-hidden="true"> · </span>') + '</p>';
  }

  /* Campo de resposta com gravação de voz e marcação de pendência. */
  function campo(o) {
    const rotulo = o.rotuloHtml || '<label class="pergunta-txt" for="' + o.id + '">' + esc(o.rotulo) + '</label>';
    return '<div class="pergunta">' + rotulo +
      (o.ajuda ? '<p class="pergunta-ajuda">' + esc(o.ajuda) + '</p>' : '') +
      linhaExemplos(o.id, o.exemplos) +
      '<textarea id="' + o.id + '" class="resposta" rows="' + (o.linhas || 3) + '" data-path="' + o.path + '">' + esc(o.valor) + '</textarea>' +
      '<div class="pergunta-acoes">' + botaoVoz(o.id) +
      '<span class="voz-status" id="vs_' + o.id + '" aria-live="polite"></span>' +
      '<label class="chk"><input type="checkbox" data-path="' + o.pathConf + '"' + (o.conf ? ' checked' : '') + '> Pendente: confirmar depois</label>' +
      '</div></div>';
  }

  function renderPerguntas(et) {
    let h = et.id === 'sol' ? renderConferencia() : '';
    if (et.lista) h += '<section class="painel">' + renderLista(et) + '</section>';
    h += '<section class="painel">';
    if (et.lista) h += '<h2 class="painel-tit">Perguntas gerais</h2>';
    let moduloAtual = '';
    h += et.perguntas.filter((p) => R.perguntaVisivel(p, estado)).map((p) => {
      const r = estado.respostas[p.id] || {};
      let tit = '';
      if ((p.modulo || '') !== moduloAtual) {
        moduloAtual = p.modulo || '';
        const m = R.MODULOS.find((x) => x.id === moduloAtual);
        if (m) tit = '<h2 class="painel-tit modulo-tit">' + esc(m.titulo) + '</h2>';
      }
      return tit + campo({ id: 'r_' + p.id, rotulo: p.q, ajuda: p.ajuda, exemplos: p.ex, path: 'respostas.' + p.id + '.texto', valor: r.texto, pathConf: 'respostas.' + p.id + '.confirmar', conf: r.confirmar });
    }).join('');
    h += renderExtras(et) + '</section>';
    h += renderAnexos(et.id);
    return h;
  }

  function renderLista(et) {
    const chave = et.lista;
    const sing = chave === 'departamentos' ? 'departamento' : 'processo';
    const Sing = sing[0].toUpperCase() + sing.slice(1);
    const campos = chave === 'departamentos' ? R.CAMPOS_DEPARTAMENTO : R.CAMPOS_PROCESSO;
    const itens = estado[chave];
    let h = '<h2 class="painel-tit">' + (chave === 'departamentos' ? 'Departamentos cadastrados' : 'Processos mapeados') + ' <span class="painel-cont">' + itens.length + '</span></h2>';
    const nomesDep = [...new Set(estado.departamentos.filter((d) => temTexto(d.nome)).map((d) => d.nome.trim()).concat(R.DEPARTAMENTOS_SUGERIDOS))];
    h += '<datalist id="' + (chave === 'processos' ? 'dl_departamentos' : 'dl_dep_sugeridos') + '">' +
      (chave === 'processos' ? nomesDep : R.DEPARTAMENTOS_SUGERIDOS).map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>';
    if (!itens.length) h += '<p class="vazio">Nenhum ' + sing + ' cadastrado.</p>';
    h += itens.map((x, i) => {
      const base = chave + '.#' + x.id;
      const corpo = campos.filter((f) => !f.modulo || estado.modulos[f.modulo]).map((f) => {
        const id = 'f_' + x.id + '_' + f.campo;
        if (f.opcoes) {
          return '<div class="campo campo-linha"><label for="' + id + '">' + esc(f.rotulo) + '</label><select id="' + id + '" data-path="' + base + '.' + f.campo + '">' +
            R[f.opcoes].map(([v, r]) => '<option value="' + v + '"' + ((x[f.campo] || '') === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></div>';
        }
        if (f.linha) {
          return '<div class="campo campo-linha"><label for="' + id + '">' + esc(f.rotulo) + '</label><input id="' + id + '" type="text" data-path="' + base + '.' + f.campo + '" value="' + esc(x[f.campo]) + '"' + (f.lista ? ' list="' + f.lista + '"' : '') + '></div>';
        }
        return campo({ id, rotulo: f.rotulo, exemplos: f.ex, path: base + '.' + f.campo, valor: x[f.campo], pathConf: base + '.' + f.campo + '__confirmar', conf: x[f.campo + '__confirmar'], linhas: 2 });
      });
      const linhas = corpo.filter((c) => c.startsWith('<div class="campo campo-linha"'));
      const textos = corpo.filter((c) => !c.startsWith('<div class="campo campo-linha"'));
      return '<div class="bloco" id="blk_' + x.id + '"><div class="bloco-cab"><span class="bloco-num">' + Sing + ' ' + (i + 1) + '</span>' +
        '<input class="bloco-nome" type="text" aria-label="Nome do ' + sing + '" placeholder="Nome do ' + sing + '" data-path="' + base + '.nome" value="' + esc(x.nome) + '"' + (chave === 'departamentos' ? ' list="dl_dep_sugeridos"' : '') + '>' +
        '<button type="button" class="btn-link" data-acao="remover" data-lista="' + chave + '" data-id="' + x.id + '">Remover</button></div>' +
        '<div class="bloco-corpo"><div class="grade-linhas">' + linhas.join('') + '</div>' + textos.join('') + '</div></div>';
    }).join('');
    h += '<div class="lista-acoes"><button type="button" class="btn btn-sec" data-acao="add-lista" data-lista="' + chave + '">Adicionar ' + sing + '</button>' +
      (chave === 'departamentos' ? '<button type="button" class="btn btn-sec" data-acao="add-deps-padrao" title="Licitações, Contratos, Financeiro, Compras, Recursos Humanos, Operacional, Administrativo, Contabilidade e prestação de contas">Adicionar departamentos sugeridos</button>' : '') + '</div>';
    return h;
  }

  function renderExtras(et) {
    const extras = estado.extras[et.id] || [];
    let h = '<div class="extras"><h3 class="extras-tit">Perguntas complementares</h3>';
    h += extras.map((x) => {
      const base = 'extras.' + et.id + '.#' + x.id;
      const rot = '<div class="extra-cab"><input type="text" class="extra-pergunta" aria-label="Pergunta complementar" placeholder="Digite a pergunta" data-path="' + base + '.pergunta" value="' + esc(x.pergunta) + '">' +
        '<button type="button" class="btn-link" data-acao="remover" data-lista="extras.' + et.id + '" data-id="' + x.id + '">Remover</button></div>';
      return campo({ id: 'x_' + x.id, rotuloHtml: rot, path: base + '.resposta', valor: x.resposta, pathConf: base + '.confirmar', conf: x.confirmar });
    }).join('');
    h += '<button type="button" class="btn btn-sec" data-acao="add-extra" data-etapa="' + et.id + '">Adicionar pergunta complementar</button></div>';
    return h;
  }

  function renderPessoas(chave, titulo, campos) {
    const itens = estado.cadastro[chave];
    const cols = campos.length;
    let h = '<section class="painel"><h2 class="painel-tit">' + titulo + ' <span class="painel-cont">' + itens.length + '</span></h2>';
    if (itens.length) {
      h += '<div class="pessoas" style="--cols:' + cols + '"><div class="pessoas-cab">' + campos.map((c) => '<span>' + c[1] + '</span>').join('') + '<span></span></div>';
      h += itens.map((p) => '<div class="pessoas-linha">' + campos.map((c) =>
        '<input type="text" aria-label="' + c[1] + '" placeholder="' + c[1] + '" data-path="cadastro.' + chave + '.#' + p.id + '.' + c[0] + '" value="' + esc(p[c[0]]) + '">').join('') +
        '<button type="button" class="btn-link" data-acao="remover" data-lista="cadastro.' + chave + '" data-id="' + p.id + '">Remover</button></div>').join('');
      h += '</div>';
    } else {
      h += '<p class="vazio">Nenhuma pessoa cadastrada.</p>';
    }
    h += '<button type="button" class="btn btn-sec" data-acao="add-pessoa" data-lista="' + chave + '">Adicionar</button></section>';
    return h;
  }

  /* Empresas do grupo: papel de cada uma (administradora, operacional). */
  function renderGrupoEmpresas() {
    const g = estado.cadastro.grupo;
    let h = '<section class="painel"><h2 class="painel-tit">Empresas do grupo <span class="painel-cont">' + g.length + '</span></h2>' +
      '<p class="texto-sec">A administradora pode ter duas visões: gestão do grupo e operação própria. Os dados de cada empresa ficam separados.</p>';
    if (!g.length) h += '<p class="vazio">Nenhuma empresa cadastrada.</p>';
    h += g.map((x, i) => {
      const base = 'cadastro.grupo.#' + x.id;
      const inp = (k, rot, ph) => '<div class="campo"><label for="g_' + x.id + '_' + k + '">' + rot + '</label><input id="g_' + x.id + '_' + k + '" type="text" placeholder="' + (ph || '') + '" data-path="' + base + '.' + k + '" value="' + esc(x[k]) + '"></div>';
      return '<div class="bloco"><div class="bloco-cab"><span class="bloco-num">Empresa ' + (i + 1) + '</span>' +
        '<input class="bloco-nome" type="text" aria-label="Nome da empresa" placeholder="Nome da empresa" data-path="' + base + '.nome" value="' + esc(x.nome) + '">' +
        '<button type="button" class="btn-link" data-acao="remover" data-lista="cadastro.grupo" data-id="' + x.id + '">Remover</button></div>' +
        '<div class="bloco-corpo"><div class="grade">' +
        '<div class="campo"><label for="g_' + x.id + '_papel">Papel no grupo</label><select id="g_' + x.id + '_papel" data-path="' + base + '.papel">' +
        R.PAPEIS_EMPRESA.map(([v, r]) => '<option value="' + v + '"' + ((x.papel || '') === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
        inp('cnpj', 'CNPJ') + inp('areas', 'Áreas de atuação', 'Ex.: alimentação, construção') + inp('obs', 'Observações') +
        '</div><label class="chk chk-bloco"><input type="checkbox" data-path="' + base + '.confirmar"' + (x.confirmar ? ' checked' : '') + '> Pendente: confirmar depois</label></div></div>';
    }).join('');
    return h + '<button type="button" class="btn btn-sec" data-acao="add-empresa">Adicionar empresa</button></section>';
  }

  /* Conferência antes de sair da visita: o que ainda falta para não deixar lacunas. */
  function lacunas() {
    const L = { essenciais: [], vagas: [], marcadas: [], departamentos: [], empresas: [], divergencias: [] };
    const cls = R.analise.classificar;
    R.ETAPAS.filter((e) => e.perguntas).forEach((e) => e.perguntas.filter((p) => R.perguntaVisivel(p, estado)).forEach((p) => {
      const r = estado.respostas[p.id] || {};
      const c = cls(r.texto, p.descritiva);
      const item = { etapa: e.id, alvo: 'r_' + p.id, texto: e.titulo + ' › ' + (p.curto || p.q) };
      if (c === 'vazia') { if (p.essencial) L.essenciais.push(item); }
      else if (c === 'vaga' || c === 'desconhecida') L.vagas.push(Object.assign(item, { texto: item.texto + ': “' + r.texto.trim() + '”' }));
      else if (r.confirmar) L.marcadas.push(item);
    }));
    if (!estado.departamentos.some((d) => temTexto(d.nome))) L.departamentos.push({ etapa: 'dep', alvo: '', texto: 'Nenhum departamento cadastrado' });
    estado.departamentos.filter((d) => temTexto(d.nome)).forEach((d) => {
      const nome = d.nome.trim();
      const falta = [];
      if (!temTexto(d.responsavel)) falta.push('responsável');
      if (!temTexto(d.atividades)) falta.push('atividades');
      if (estado.modulos.grupo && !d.onde) falta.push('onde funciona no grupo');
      const n = R.analise.norm(nome);
      if (!estado.processos.some((p) => temTexto(p.etapas) && R.analise.norm(p.departamento || '').includes(n))) falta.push('processo com passo a passo');
      if (falta.length) L.departamentos.push({ etapa: d.onde || !estado.modulos.grupo ? (falta.includes('processo com passo a passo') && falta.length === 1 ? 'pro' : 'dep') : 'dep', alvo: 'blk_' + d.id, texto: nome + ': falta ' + falta.join(', ') });
    });
    if (estado.modulos.grupo) {
      const g = estado.cadastro.grupo.filter((x) => temTexto(x.nome));
      if (g.length < 2) L.empresas.push({ etapa: 'cadastro', alvo: '', texto: 'Cadastrar as empresas do grupo' });
      if (g.length && !g.some((x) => /^administradora/.test(x.papel || ''))) L.empresas.push({ etapa: 'cadastro', alvo: '', texto: 'Definir qual empresa é a administradora' });
      g.forEach((x) => {
        const falta = [];
        if (!x.papel) falta.push('papel');
        if (!temTexto(x.cnpj)) falta.push('CNPJ');
        if (!temTexto(x.areas)) falta.push('áreas de atuação');
        if (x.confirmar) falta.push('confirmar dados');
        if (falta.length) L.empresas.push({ etapa: 'cadastro', alvo: 'g_' + x.id + '_papel', texto: x.nome.trim() + ': ' + falta.join(', ') });
      });
    }
    try { const A2 = R.analise.analisar(estado); if (A2.divergencia) L.divergencias.push({ etapa: '', alvo: '', texto: 'Volumes diferentes: ' + A2.divergencia.map((v) => '“' + v.trecho + '”').join(' e ') }); } catch (e) { /* análise indisponível */ }
    return L;
  }

  function renderConferencia() {
    const L = lacunas();
    const grupos = [
      ['Perguntas essenciais sem resposta', L.essenciais],
      ['Respostas vagas para detalhar', L.vagas],
      ['Empresas do grupo', L.empresas],
      ['Departamentos incompletos', L.departamentos],
      ['Informações divergentes', L.divergencias],
      ['Marcadas para confirmar', L.marcadas]
    ].filter((g) => g[1].length);
    const total = grupos.reduce((s2, g) => s2 + g[1].length, 0);
    let h = '<section class="painel conferencia nao-imprimir"><h2 class="painel-tit">Conferência antes de sair da visita</h2>';
    if (!total) return h + '<p class="conf-ok">Nenhuma lacuna encontrada.</p></section>';
    h += '<p class="conf-resumo">' + total + (total === 1 ? ' item ainda precisa' : ' itens ainda precisam') + ' de resposta ou confirmação.</p>';
    h += grupos.map(([tit, itens]) => '<details class="conf-grupo"' + (tit.startsWith('Marcadas') ? '' : ' open') + '><summary>' + tit + ' <span class="painel-cont">' + itens.length + '</span></summary><ul>' +
      itens.map((x) => '<li><span>' + esc(x.texto) + '</span>' + (x.etapa ? '<button type="button" class="btn-link" data-acao="ir-pergunta" data-etapa="' + x.etapa + '" data-alvo="' + x.alvo + '">Ir</button>' : '') + '</li>').join('') +
      '</ul></details>').join('');
    return h + '</section>';
  }

  function renderCadastro() {
    const c = estado.cadastro;
    const inp = (k, rot, tipo, obrig) => '<div class="campo"><label for="cad_' + k + '">' + rot + (obrig ? ' <span class="obrig">obrigatório</span>' : '') + '</label>' +
      '<input id="cad_' + k + '" type="' + (tipo || 'text') + '" data-path="cadastro.' + k + '" value="' + esc(c[k]) + '"></div>';
    const portes = ['', 'Microempreendedor individual (MEI)', 'Microempresa', 'Pequena empresa', 'Média empresa', 'Grande empresa'];
    const sel = '<div class="campo"><label for="cad_porte">Porte <span class="obrig">obrigatório</span></label><select id="cad_porte" data-path="cadastro.porte">' +
      portes.map((p) => '<option value="' + esc(p) + '"' + (c.porte === p ? ' selected' : '') + '>' + (p || 'Selecione') + '</option>').join('') +
      (c.porte && !portes.includes(c.porte) ? '<option selected value="' + esc(c.porte) + '">' + esc(c.porte) + '</option>' : '') + '</select></div>';
    const modulos = '<section class="painel"><h2 class="painel-tit">Módulos de perguntas</h2>' +
      '<p class="texto-sec">Ative conforme o cliente. Cada módulo acrescenta perguntas nas etapas e entra na conferência de lacunas.</p><div class="modulos">' +
      R.MODULOS.map((m) => '<label class="modulo"><input type="checkbox" data-path="modulos.' + m.id + '"' + (estado.modulos[m.id] ? ' checked' : '') + '><span><strong>' + esc(m.titulo) + '</strong><br><span class="texto-sec">' + esc(m.desc) + '</span></span></label>').join('') +
      '</div></section>';
    return modulos + '<section class="painel"><h2 class="painel-tit">Empresa</h2><div class="grade">' +
      inp('empresa', 'Nome ou razão social', 'text', true) + inp('fantasia', 'Nome fantasia') + inp('cnpj', 'CNPJ') +
      inp('ramo', 'Ramo de atuação', 'text', true) + sel + inp('cidade', 'Cidade / UF') + inp('site', 'Site') +
      inp('dataVisita', 'Data da visita', 'date') + inp('consultor', 'Responsável pelo levantamento') +
      '</div></section>' +
      renderPessoas('responsaveis', 'Responsáveis na empresa', [['nome', 'Nome'], ['cargo', 'Cargo'], ['contato', 'Telefone ou e-mail']]) +
      renderPessoas('entrevistados', 'Entrevistados', [['nome', 'Nome'], ['cargo', 'Cargo ou função'], ['departamento', 'Departamento'], ['contato', 'Telefone ou e-mail']]) +
      (estado.modulos.grupo ? renderGrupoEmpresas() : '') +
      renderAnexos('cadastro');
  }

  /* ---------- Relatório de diagnóstico e proposta ---------- */
  function renderDiagnostico() {
    const d = estado.diagnostico;
    const g = progressoGeral();
    if (!d) {
      return '<section class="painel"><p>O relatório organiza a entrevista em resumo executivo, diagnóstico por departamento, processos atuais e futuros, soluções propostas, diagramas, requisitos, arquitetura, etapas de desenvolvimento, riscos e aprovação.</p>' +
        '<p class="texto-sec">Cada item indica se foi informado pelo cliente, se está pendente, se é inferência do sistema ou recomendação técnica. Respostas registradas: ' + g.feitas + ' de ' + g.total + '.</p>' +
        '<button type="button" class="btn btn-pri" data-acao="gerar">Gerar relatório</button></section>';
    }
    const c = estado.cadastro;
    const meta = [];
    if (temTexto(c.dataVisita)) meta.push('Visita em ' + new Date(c.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR'));
    if (temTexto(c.consultor)) meta.push('Levantamento: ' + esc(c.consultor));
    meta.push('Gerado em ' + new Date(d.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));

    let h = '';
    if (d.versao !== 2) h += '<p class="aviso nao-imprimir">Este relatório foi gerado no formato anterior. Use “Gerar novamente” para aplicar a nova análise por departamento.</p>';
    if (diagDesatualizado()) h += '<p class="aviso nao-imprimir">Respostas alteradas depois da geração. Use “Gerar novamente” para incluí-las; isso substitui as edições feitas no relatório.</p>';
    let n = 0;
    const numeradas = d.secoes.map((s) => (s.anexo ? 'Anexo' : String(++n)));
    h += '<article class="painel doc">' +
      '<header class="doc-cab"><p class="doc-marca">Requisio · Diagnóstico e proposta de solução</p><h1>' + esc(temTexto(c.empresa) ? c.empresa : 'Empresa não informada') + '</h1>' +
      '<p class="doc-meta">' + meta.join(' · ') + '</p>' +
      '<p class="legenda">' + Object.keys(ORIGENS).map((k) => '<span class="o-' + k + '">' + ORIGENS[k] + '</span>').join('') + '</p>' +
      '<p class="texto-sec">Inferências e recomendações do sistema não são requisitos aprovados. Somente itens e soluções marcados como aprovados pelo cliente valem como aprovados.<span class="nao-imprimir"> Todo o texto pode ser editado: clique no item para alterar.</span></p>' +
      '<nav class="sumario" aria-label="Sumário"><p class="sumario-tit">Sumário</p><ol>' + d.secoes.map((s, i) => '<li><a href="#sec-' + s.id + '">' + (s.anexo ? '' : numeradas[i] + '. ') + esc(s.titulo) + '</a></li>').join('') + '</ol></nav></header>';
    h += d.secoes.map((s, i) => {
      const bs = 'diagnostico.secoes.#' + s.id;
      return '<section class="diag-secao' + (s.anexo ? ' secao-anexo' : '') + '" id="sec-' + s.id + '"><h2>' + (s.anexo ? '' : numeradas[i] + '. ') + esc(s.titulo) + '</h2>' +
        (temTexto(s.nota) ? '<p class="nota" contenteditable="' + EDITAVEL + '" data-path="' + bs + '.nota">' + esc(s.nota) + '</p>' : '') +
        s.grupos.map((gr) => renderGrupo(bs + '.grupos.#' + gr.id, gr)).join('') + '</section>';
    }).join('');
    h += '</article>';
    return h;
  }

  function renderGrupo(base, gr) {
    const tag = gr.nivel === 4 ? 'h4' : 'h3';
    const tit = temTexto(gr.titulo) ? '<' + tag + '>' + esc(gr.titulo) + '</' + tag + '>' : '';
    const nota = temTexto(gr.nota) ? '<p class="nota" contenteditable="' + EDITAVEL + '" data-path="' + base + '.nota">' + esc(gr.nota) + '</p>' : '';
    if (gr.tipo === 'cabecalho') return '<div class="dep-cab"><h3>' + esc(gr.titulo) + '</h3>' + nota + '</div>';
    if (gr.tipo === 'diagrama') return renderDiagrama(base, gr, tit);
    if (gr.tipo === 'validacao') return renderValidacao(gr, tit);
    if (gr.tipo === 'anexos') return '<div class="diag-grupo">' + tit + renderAnexosRelatorio() + '</div>';
    if (gr.tipo === 'aprovacoes') return '<div class="diag-grupo">' + tit + renderAprovacoes(gr) + '</div>';
    if (gr.tipo === 'assinatura') {
      return '<div class="diag-grupo">' + tit + '<div class="assinaturas">' +
        ['Responsável pela empresa', 'Responsável pelo levantamento'].map((r) => '<div class="assinatura"><span class="assinatura-linha"></span><span>' + r + '</span><span class="texto-sec">Data: ____/____/______</span></div>').join('') + '</div></div>';
    }
    let h = '<div class="diag-grupo"' + (gr.prefixo ? ' data-numerado' : '') + '>' + tit + nota;
    if (!gr.itens.length) h += '<p class="vazio">Nenhum item.</p>';
    h += gr.itens.map((it) => renderItem(base + '.itens.#' + it.id, it, gr)).join('');
    h += '<button type="button" class="btn-link nao-imprimir" data-acao="add-item" data-grupo="' + base + '" data-status="' + (gr.comStatus ? '1' : '') + '">Adicionar item</button></div>';
    return h;
  }

  function renderDiagrama(base, gr, tit) {
    return '<div class="diag-grupo diagrama-grupo">' + tit +
      (gr.preliminar ? '<p class="o-pendente rotulo-prelim">Diagrama preliminar</p>' : '') +
      (temTexto(gr.nota) ? '<p class="nota">' + esc(gr.nota) + '</p>' : '') +
      '<div class="diagrama" data-mermaid data-codigo="' + esc(gr.codigo) + '"><p class="texto-sec">Desenhando diagrama…</p></div>' +
      '<details class="nao-imprimir diagrama-codigo"><summary>Editar código do diagrama (Mermaid)</summary>' +
      '<textarea class="codigo-mermaid" spellcheck="false" rows="8" data-path="' + base + '.codigo">' + esc(gr.codigo) + '</textarea></details></div>';
  }

  function renderAnexosRelatorio() {
    if (!estado.anexos.length) return '<p class="vazio">Nenhum anexo.</p>';
    return '<div class="anexos-rel">' + estado.anexos.map((a) => {
      const et = etapaPorId(a.etapa);
      return '<figure class="anexo-rel">' + (ehImagem(a) ? '<img alt="' + esc(a.descricao || a.nome) + '" data-anexo-img="' + a.id + '">' : '') +
        '<figcaption><strong>' + esc(a.nome) + '</strong> · ' + esc(et ? et.titulo : '') + (temTexto(a.descricao) ? '<br>' + esc(a.descricao) : '') +
        ' <a class="btn-link nao-imprimir" data-anexo-link="' + a.id + '" target="_blank" rel="noopener" download="' + esc(a.nome) + '">Abrir</a></figcaption></figure>';
    }).join('') + '</div>';
  }

  function validacaoDe(chave) {
    return Object.assign({ status: 'pendente', comentario: '', data: '', versao: '' }, estado.validacao[chave] || {});
  }

  function renderValidacao(gr, tit) {
    const v = validacaoDe(gr.chave);
    const antiga = v.status !== 'pendente' && v.versao && estado.diagnostico && v.versao !== estado.diagnostico.geradoEm;
    const quando = v.data ? ' em ' + new Date(v.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    return '<div class="diag-grupo validacao" data-validacao="' + gr.chave + '" data-status="' + v.status + '">' + tit +
      '<div class="validacao-linha"><label for="val_' + gr.chave + '">Decisão do cliente</label>' +
      '<select id="val_' + gr.chave + '" class="validacao-status" data-path="validacao.' + gr.chave + '.status">' +
      Object.keys(VALIDACAO).map((k) => '<option value="' + k + '"' + (v.status === k ? ' selected' : '') + '>' + VALIDACAO[k] + '</option>').join('') + '</select>' +
      '<span class="so-impressao rot-validacao">' + VALIDACAO[v.status] + quando + '</span>' +
      '<span class="texto-sec validacao-data nao-imprimir">' + (v.status !== 'pendente' ? 'Registrada' + quando : 'Não aprovada') + '</span></div>' +
      (antiga ? '<p class="aviso">Decisão registrada para uma versão anterior do relatório. Revise e confirme novamente.</p>' : '') +
      '<label class="validacao-com-rot" for="valc_' + gr.chave + '">Comentário ou alterações solicitadas</label>' +
      '<textarea id="valc_' + gr.chave + '" class="resposta validacao-com" rows="2" data-path="validacao.' + gr.chave + '.comentario">' + esc(v.comentario) + '</textarea></div>';
  }

  function renderAprovacoes(gr) {
    if (!gr.chaves || !gr.chaves.length) return '<p class="vazio">Nenhuma solução proposta para aprovar.</p>';
    return '<table class="tabela-aprov"><thead><tr><th>Solução</th><th>Decisão</th><th>Comentário</th></tr></thead><tbody>' +
      gr.chaves.map((k, i) => {
        const v = validacaoDe(k);
        return '<tr data-aprov-chave="' + k + '"><td>' + esc(gr.nomes[i] || k) + '</td><td class="aprov-status" data-status="' + v.status + '">' + VALIDACAO[v.status] + '</td><td class="aprov-com">' + esc(v.comentario) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function atualizarAprovacoes(chave) {
    const v = validacaoDe(chave);
    document.querySelectorAll('[data-aprov-chave="' + chave + '"]').forEach((tr) => {
      const st = tr.querySelector('.aprov-status');
      st.textContent = VALIDACAO[v.status];
      st.dataset.status = v.status;
      tr.querySelector('.aprov-com').textContent = v.comentario;
    });
    const bloco = document.querySelector('[data-validacao="' + chave + '"]');
    if (bloco) {
      bloco.dataset.status = v.status;
      const quando = v.data ? ' em ' + new Date(v.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      bloco.querySelector('.rot-validacao').textContent = VALIDACAO[v.status] + quando;
      bloco.querySelector('.validacao-data').textContent = v.status !== 'pendente' ? 'Registrada' + quando : 'Não aprovada';
    }
  }

  function renderItem(base, it, gr) {
    const origemSel = '<select class="item-origem" aria-label="Origem da informação" data-path="' + base + '.origem">' +
      Object.keys(ORIGENS).map((k) => '<option value="' + k + '"' + (it.origem === k ? ' selected' : '') + '>' + ORIGENS[k] + '</option>').join('') + '</select>' +
      '<span class="so-impressao rot-origem">' + (ORIGENS[it.origem] || '') + '</span>';
    const statusSel = gr.comStatus ? '<select class="item-status" aria-label="Situação" data-path="' + base + '.status">' +
      Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (it.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('') + '</select>' +
      '<span class="so-impressao rot-status">' + STATUS[it.status || 'a_validar'] + '</span>' : '';
    const cod = gr.prefixo ? '<span class="item-cod" data-p="' + esc(gr.prefixo) + '"></span>' : '';
    return '<div class="item" data-origem="' + it.origem + '"' + (it.status ? ' data-status="' + it.status + '"' : '') + '>' +
      '<div class="item-meta">' + cod + origemSel + statusSel +
      (temTexto(it.fonte) ? '<span class="item-fonte">Fonte: ' + esc(it.fonte) + '</span>' : '') +
      '<button type="button" class="btn-link item-remover nao-imprimir" data-acao="remover-item" data-grupo="' + base.replace(/\.itens\.#[^.]+$/, '') + '" data-id="' + it.id + '">Remover</button></div>' +
      '<div class="item-texto" contenteditable="' + EDITAVEL + '" role="textbox" aria-multiline="true" aria-label="Texto do item" data-path="' + base + '.texto">' + esc(it.texto) + '</div></div>';
  }

  /* ================= Edição ================= */
  /* Cresce o campo conforme o texto sem deixar a página pular durante a digitação. */
  function ajustarAltura(el) {
    const y = window.scrollY;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
    if (window.scrollY !== y) window.scrollTo(0, y);
  }

  function aoEditar(e) {
    const el = e.target;
    if (el.dataset && el.dataset.anexar !== undefined) { if (e.type === 'change') anexarArquivos(el); return; }
    if (el.id === 'selEtapa') { if (e.type === 'change') ir(el.value); return; }
    if (!el.dataset || !el.dataset.path) return;
    const valor = el.type === 'checkbox' ? el.checked : el.isContentEditable ? el.innerText.replace(/\n$/, '') : el.value;
    if (obter(el.dataset.path) === valor) return;
    if (!definir(el.dataset.path, valor)) return;
    marcarRespostaAlterada(el.dataset.path);
    if (el.tagName === 'TEXTAREA') ajustarAltura(el);
    if (el.classList.contains('item-origem')) {
      const item = el.closest('.item');
      item.dataset.origem = valor;
      item.querySelector('.rot-origem').textContent = ORIGENS[valor];
    }
    if (el.classList.contains('item-status')) {
      const item = el.closest('.item');
      item.dataset.status = valor;
      item.querySelector('.rot-status').textContent = STATUS[valor];
    }
    if (el.dataset.path === 'cadastro.empresa') atualizarTopo();
    if (el.dataset.path.startsWith('modulos.')) { agendarSalvar(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    if (el.dataset.path.startsWith('validacao.')) {
      const chave = el.dataset.path.split('.')[1];
      if (el.classList.contains('validacao-status')) {
        estado.validacao[chave].data = new Date().toISOString();
        estado.validacao[chave].versao = estado.diagnostico ? estado.diagnostico.geradoEm : '';
      }
      atualizarAprovacoes(chave);
    }
    if (el.classList.contains('codigo-mermaid')) {
      const alvo = el.closest('.diagrama-grupo').querySelector('.diagrama');
      alvo.dataset.codigo = valor;
      clearTimeout(el._timer);
      el._timer = setTimeout(() => R.diagramas.redesenhar(alvo), 600);
    }
    agendarSalvar();
    agendarProgresso();
  }

  document.addEventListener('input', aoEditar);
  document.addEventListener('change', aoEditar);

  // Colagem como texto puro nos itens editáveis (navegadores sem "plaintext-only").
  document.addEventListener('paste', (e) => {
    const el = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!el) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  /* ================= Ações ================= */
  /* Troca de etapa. Cada etapa entra no histórico: o gesto ou botão Voltar volta de etapa. */
  function ir(id, semHistorico) {
    if (!etapaPorId(id)) return;
    salvarPendencias();
    estado.etapaAtual = id;
    visao = null;
    agendarSalvar();
    salvarAgora(true);
    if (!semHistorico) {
      try { history.pushState({ etapa: id }, '', '#' + id); } catch (e) { /* sem histórico (ex.: arquivo local restrito) */ }
    }
    render(true);
  }

  window.addEventListener('popstate', (e) => {
    const id = e.state && e.state.etapa;
    if (id && (id !== estado.etapaAtual || visao)) ir(id, true);
  });

  function marcarHistorico() {
    try { history.replaceState({ etapa: estado.etapaAtual }, '', '#' + estado.etapaAtual); } catch (e) { /* ignora */ }
  }

  /* Garante que o valor digitado no campo com foco já está no estado antes de trocar de tela. */
  function salvarPendencias() {
    const el = document.activeElement;
    if (el && el.dataset && el.dataset.path) aoEditar({ target: el, type: 'input' });
  }

  function focar(seletor) {
    const el = principal.querySelector(seletor);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  }

  function temConteudo(x) {
    return Object.keys(x).some((k) => k !== 'id' && typeof x[k] === 'string' && x[k].trim());
  }

  function gerarDiagnostico() {
    salvarPendencias();
    if (estado.diagnostico && !confirm('Gerar novamente substitui o relatório atual, incluindo as edições feitas nele. As decisões de aprovação ficam registradas, mas passam a se referir à versão anterior. Continuar?')) return false;
    estado.diagnostico = R.relatorio.gerar(estado);
    estado.meta.respostasAlteradasEm = '';
    estado.etapaAtual = 'diagnostico';
    agendarSalvar();
    salvarAgora();
    render(true);
    return true;
  }

  const ACOES = {
    ir: (b) => ir(b.dataset.etapa),
    'add-lista': (b) => {
      const novo = { id: R.uid(), nome: '' };
      estado[b.dataset.lista].push(novo);
      marcarRespostaAlterada(b.dataset.lista);
      agendarSalvar(); render();
      focar('#blk_' + novo.id + ' .bloco-nome');
    },
    'add-pessoa': (b) => {
      const novo = { id: R.uid(), nome: '', cargo: '', contato: '' };
      if (b.dataset.lista === 'entrevistados') novo.departamento = '';
      estado.cadastro[b.dataset.lista].push(novo);
      marcarRespostaAlterada('cadastro');
      agendarSalvar(); render();
      focar('[data-path="cadastro.' + b.dataset.lista + '.#' + novo.id + '.nome"]');
    },
    'add-extra': (b) => {
      const eid = b.dataset.etapa;
      if (!Array.isArray(estado.extras[eid])) estado.extras[eid] = [];
      const novo = { id: R.uid(), pergunta: '', resposta: '', confirmar: false };
      estado.extras[eid].push(novo);
      agendarSalvar(); render();
      focar('[data-path="extras.' + eid + '.#' + novo.id + '.pergunta"]');
    },
    remover: (b) => {
      const lista = obter(b.dataset.lista);
      if (!Array.isArray(lista)) return;
      const i = lista.findIndex((x) => x.id === b.dataset.id);
      if (i < 0) return;
      if (temConteudo(lista[i]) && !confirm('Remover este registro e as respostas dele?')) return;
      salvarPendencias();
      lista.splice(i, 1);
      marcarRespostaAlterada(b.dataset.lista);
      agendarSalvar(); render();
    },
    'add-item': (b) => {
      const g = obter(b.dataset.grupo);
      if (!g) return;
      const novo = { id: R.uid(), texto: '', origem: 'cliente', fonte: 'Incluído na revisão' };
      if (b.dataset.status) novo.status = 'a_validar';
      g.itens.push(novo);
      agendarSalvar(); render();
      focar('[data-path="' + b.dataset.grupo + '.itens.#' + novo.id + '.texto"]');
    },
    'remover-item': (b) => {
      const g = obter(b.dataset.grupo);
      if (!g) return;
      const i = g.itens.findIndex((x) => x.id === b.dataset.id);
      if (i < 0) return;
      if (temTexto(g.itens[i].texto) && !confirm('Remover este item do diagnóstico?')) return;
      g.itens.splice(i, 1);
      agendarSalvar();
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    },
    voz: (b) => acaoVoz(b),
    'add-empresa': () => {
      const n = estado.cadastro.grupo.length + 1;
      const novo = { id: R.uid(), nome: 'Empresa ' + String(n).padStart(2, '0'), papel: '', cnpj: '', areas: '', obs: '', confirmar: false };
      estado.cadastro.grupo.push(novo);
      marcarRespostaAlterada('cadastro');
      agendarSalvar(); render();
      focar('[data-path="cadastro.grupo.#' + novo.id + '.nome"]');
    },
    'add-deps-padrao': () => {
      const existentes = estado.departamentos.map((d) => R.analise.norm((d.nome || '').trim()));
      let n = 0;
      R.DEPARTAMENTOS_PADRAO.forEach(([nome]) => {
        if (existentes.includes(R.analise.norm(nome))) return;
        estado.departamentos.push({ id: R.uid(), nome });
        n++;
      });
      marcarRespostaAlterada('departamentos');
      agendarSalvar(); render();
      mostrarStatus(n ? n + (n === 1 ? ' departamento adicionado.' : ' departamentos adicionados.') : 'Os departamentos sugeridos já estão na lista.');
    },
    'ir-pergunta': (b) => {
      if (b.dataset.etapa !== estado.etapaAtual) ir(b.dataset.etapa);
      const el = b.dataset.alvo && document.getElementById(b.dataset.alvo);
      if (el) { el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus({ preventScroll: true }); }
    },
    exemplo: (b) => {
      const el = document.getElementById(b.dataset.alvo);
      if (!el) return;
      const texto = b.dataset.texto;
      if (!el.value.includes(texto)) {
        el.value = el.value.trim() ? el.value.replace(/\s+$/, '') + '\n' + texto : texto;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    },
    finalizar: () => {
      salvarPendencias();
      if (!estado.diagnostico) { gerarDiagnostico(); return; }
      if (diagDesatualizado() && gerarDiagnostico()) return;
      ir('diagnostico');
    },
    gerar: () => gerarDiagnostico(),
    imprimir: () => { salvarPendencias(); salvarAgora(); window.print(); },
    exportar: () => exportar(),
    importar: () => { arquivoImportar.value = ''; arquivoImportar.click(); },
    novo: () => {
      if (!confirm('Iniciar um novo levantamento? O atual continua salvo em “Levantamentos”.')) return;
      R.voz.parar();
      salvarPendencias();
      sujo = true; salvarAgora(true);
      A.guardar(estado).catch(() => {});
      estado = A.inicial();
      visao = null;
      sujo = true; salvarAgora(true);
      marcarHistorico();
      render(true);
      mostrarStatus('Novo levantamento iniciado. O anterior está em “Levantamentos”.');
    },
    lista: () => { menuAberto(false); salvarPendencias(); sujo = true; salvarAgora(true); visao = 'lista'; R.voz.parar(); render(true); },
    'abrir-lev': (b) => abrirLevantamento(b.dataset.id),
    'exportar-lev': (b) => A.abrir(b.dataset.id).then((e) => (e ? exportar(e) : alert('Levantamento não encontrado.'))),
    'excluir-lev': (b) => moverParaLixeira(b.dataset.id, b.dataset.nome),
    'restaurar-lev': (b) => {
      A.restaurar(b.dataset.id).then(() => { mostrarStatus('Levantamento “' + (b.dataset.nome || 'sem nome') + '” restaurado.'); render(); }).catch(() => alert('Não foi possível restaurar.'));
    },
    'apagar-lev': (b) => {
      if (!confirm('Excluir definitivamente “' + (b.dataset.nome || 'sem nome') + '”, com relatório e anexos? Esta ação não pode ser desfeita.')) return;
      A.excluir(b.dataset.id).then(() => { mostrarStatus('Levantamento excluído definitivamente.'); render(); }).catch(() => alert('Não foi possível excluir.'));
    },
    'remover-anexo': (b) => {
      const i = estado.anexos.findIndex((a) => a.id === b.dataset.id);
      if (i < 0 || !confirm('Remover o anexo “' + estado.anexos[i].nome + '”?')) return;
      const id = estado.anexos[i].id;
      estado.anexos.splice(i, 1);
      sujo = true; agendarSalvar(); salvarAgora(true);
      A.excluirArquivo(id).catch(() => {});
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }
  };

  /* Menu "Arquivo" do topo em telas estreitas */
  const topoAcoes = document.getElementById('topoAcoes');
  const menuBtn = document.querySelector('.topo-menu-btn');
  function menuAberto(abrir) {
    topoAcoes.classList.toggle('aberto', abrir);
    menuBtn.setAttribute('aria-expanded', String(abrir));
  }
  ACOES.menu = () => menuAberto(!topoAcoes.classList.contains('aberto'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menuAberto(false); });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topo-menu-btn')) menuAberto(false);
    const b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    const fn = ACOES[b.dataset.acao];
    if (fn) { e.preventDefault(); fn(b); }
  });

  /* ================= Voz ================= */
  let aguardandoVoz = null;

  function acaoVoz(b) {
    const alvo = document.getElementById(b.dataset.alvo);
    if (!alvo) return;
    if (R.voz.ativoPara(alvo.id)) { R.voz.parar(); return; }
    if (!estado.meta.autorizacaoGravacao) {
      aguardandoVoz = alvo.id;
      dlgGravacao.returnValue = '';
      dlgGravacao.showModal();
      return;
    }
    iniciarVoz(alvo);
  }

  dlgGravacao.addEventListener('close', () => {
    const id = aguardandoVoz;
    aguardandoVoz = null;
    if (dlgGravacao.returnValue !== 'ok') return;
    estado.meta.autorizacaoGravacao = new Date().toISOString();
    agendarSalvar();
    const alvo = id && document.getElementById(id);
    if (alvo) iniciarVoz(alvo);
  });

  function iniciarVoz(alvo) {
    atualizarBotaoVoz(alvo.id, 'iniciando', 'Iniciando microfone…');
    R.voz.iniciar({ campoId: alvo.id, path: alvo.dataset.path, aoTexto: anexarTranscricao, aoEstado: atualizarBotaoVoz });
  }

  function juntar(atual, texto, inicioSessao) {
    let sep = '';
    if (atual && !/\s$/.test(atual)) sep = inicioSessao ? '\n' : ' ';
    if (inicioSessao || !atual || /[.!?]\s*$/.test(atual)) texto = texto.charAt(0).toUpperCase() + texto.slice(1);
    return atual + sep + texto;
  }

  /* Grava o trecho transcrito no campo; se a tela mudou, grava direto no estado. */
  function anexarTranscricao(campoId, caminho, texto, inicioSessao) {
    const el = document.getElementById(campoId);
    if (el && el.dataset.path === caminho) {
      el.value = juntar(el.value, texto, inicioSessao);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const atual = obter(caminho);
    if (definir(caminho, juntar(typeof atual === 'string' ? atual : '', texto, inicioSessao))) {
      marcarRespostaAlterada(caminho);
      agendarSalvar();
      agendarProgresso();
    }
  }

  function atualizarBotaoVoz(campoId, situacao, msg) {
    const b = document.querySelector('[data-acao="voz"][data-alvo="' + campoId + '"]');
    const s = document.getElementById('vs_' + campoId);
    const ouvindo = situacao === 'ouvindo' || situacao === 'iniciando';
    if (b) {
      b.classList.toggle('gravando', ouvindo);
      b.setAttribute('aria-pressed', String(ouvindo));
      b.querySelector('span').textContent = ouvindo ? 'Parar' : 'Gravar';
    }
    if (s) {
      s.textContent = msg || '';
      s.classList.toggle('erro', situacao === 'erro');
    }
  }

  /* ================= Exportar / importar ================= */
  function blobParaDataURL(blob) {
    return new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
  }

  /* Exporta o levantamento (o aberto ou outro da lista) com os arquivos anexados embutidos. */
  async function exportar(alvo) {
    salvarPendencias();
    salvarAgora(true);
    const e = alvo || estado;
    mostrarStatus('Preparando exportação…');
    const arquivos = {};
    for (const a of e.anexos || []) {
      try { const b = await A.lerArquivo(a.id); if (b) arquivos[a.id] = await blobParaDataURL(b); } catch (err) { /* arquivo ausente */ }
    }
    const nome = (e.cadastro.empresa || 'levantamento').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'levantamento';
    const data = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(Object.assign({}, e, { arquivos }), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'requisio-' + nome + '-' + data + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mostrarStatus('Arquivo JSON exportado às ' + hora(new Date()));
  }

  async function dataURLParaBlob(u) { return (await fetch(u)).blob(); }

  /* Importa como levantamento da lista (não apaga o aberto). */
  arquivoImportar.addEventListener('change', () => {
    const arq = arquivoImportar.files && arquivoImportar.files[0];
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      let bruto, novo;
      try {
        bruto = JSON.parse(String(leitor.result));
        novo = A.normalizar(bruto);
      } catch (e) {
        alert('Não foi possível importar: ' + (e instanceof SyntaxError ? 'o arquivo não é um JSON válido.' : e.message));
        return;
      }
      const nome = novo.cadastro.empresa || 'sem nome';
      if (await A.existeNaLista(novo.meta.id) || novo.meta.id === estado.meta.id) {
        if (!confirm('Já existe um levantamento salvo com este arquivo (“' + nome + '”).\n\nOK: substituir o salvo pela versão do arquivo.\nCancelar: importar como cópia separada.')) {
          novo.meta.id = R.uid();
        }
      } else if (!confirm('Importar o levantamento “' + nome + '”? O levantamento aberto continua salvo em “Levantamentos”.')) {
        return;
      }
      mostrarStatus('Importando…');
      const arquivos = bruto && typeof bruto.arquivos === 'object' && bruto.arquivos ? bruto.arquivos : {};
      for (const a of novo.anexos) {
        const u = arquivos[a.id];
        if (typeof u === 'string' && u.startsWith('data:')) {
          try { await A.salvarArquivo(a.id, await dataURLParaBlob(u)); } catch (e) { /* sem espaço */ }
        }
      }
      R.voz.parar();
      salvarPendencias();
      sujo = true; salvarAgora(true);
      A.guardar(estado).catch(() => {});
      estado = novo;
      estado.meta.atualizadoEm = new Date().toISOString();
      visao = null;
      sujo = true;
      salvarAgora(true);
      marcarHistorico();
      render(true);
      mostrarStatus('Levantamento importado e salvo às ' + hora(new Date()));
    };
    leitor.onerror = () => alert('Não foi possível ler o arquivo.');
    leitor.readAsText(arq);
  });

  /* ================= Levantamentos salvos ================= */
  function abrirLevantamento(id) {
    if (id === estado.meta.id) { visao = null; render(true); return; }
    salvarPendencias();
    sujo = true; salvarAgora(true);
    A.guardar(estado).catch(() => {});
    A.abrir(id).then((e) => {
      if (!e) { alert('Levantamento não encontrado.'); return; }
      R.voz.parar();
      estado = e;
      visao = null;
      sujo = true; salvarAgora(true);
      marcarHistorico();
      render(true);
      mostrarStatus('Levantamento “' + (e.cadastro.empresa || 'sem nome') + '” aberto.');
    });
  }

  function dataCurta(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  }

  /* Move para a lixeira (pode ser restaurado). Se for o aberto, abre o mais recente dos outros ou um novo. */
  function moverParaLixeira(id, nome) {
    if (!confirm('Mover “' + (nome || 'sem nome') + '” para a lixeira? Ele pode ser restaurado em até ' + A.DIAS_LIXEIRA + ' dias.')) return;
    const fim = () => { mostrarStatus('“' + (nome || 'sem nome') + '” foi para a lixeira.'); render(); };
    if (id !== estado.meta.id) { A.moverParaLixeira(id).then(fim).catch(() => alert('Não foi possível excluir.')); return; }
    R.voz.parar();
    salvarPendencias();
    estado.meta.excluidoEm = new Date().toISOString();
    sujo = true; salvarAgora(true);
    A.guardar(estado).catch(() => {}).then(() => A.listar(null)).then((l) => {
      const outro = l.find((x) => !x.excluidoEm && x.id !== id);
      return outro ? A.abrir(outro.id) : null;
    }).then((e) => {
      estado = e || A.inicial();
      sujo = true; salvarAgora(true);
      marcarHistorico();
      fim();
    });
  }

  const ICONE_LIXEIRA = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

  function renderLevantamentos() {
    principal.innerHTML = '<div class="pag-cab"><div><h1>Levantamentos salvos</h1><p class="pag-desc">Todos os levantamentos guardados neste aparelho, com relatório e anexos.</p></div>' +
      '<div class="pag-cab-dir"><button type="button" class="btn btn-pri" data-acao="novo">Novo levantamento</button></div></div>' +
      '<section class="painel" id="listaLev"><p class="texto-sec">Carregando…</p></section>';
    A.listar(estado).then((l) => {
      document.querySelectorAll('.painel.lixeira').forEach((x) => x.remove());
      const alvo = document.getElementById('listaLev');
      if (!alvo) return;
      const lixeira = l.filter((x) => x.excluidoEm);
      l = l.filter((x) => !x.excluidoEm);
      const htmlLixeira = lixeira.length ? '<section class="painel lixeira"><h2 class="painel-tit">Lixeira <span class="painel-cont">' + lixeira.length + '</span></h2>' +
        '<p class="texto-sec">Levantamentos excluídos podem ser restaurados por ' + A.DIAS_LIXEIRA + ' dias. Depois disso, são apagados definitivamente.</p>' +
        '<table class="tabela-lev"><thead><tr><th>Empresa</th><th>Excluído em</th><th>Relatório</th><th></th></tr></thead><tbody>' +
        lixeira.map((x) => {
          const nome = x.empresa || 'Empresa não informada';
          return '<tr><td data-rot="Empresa"><div class="lev-cel"><strong>' + esc(nome) + '</strong></div></td><td data-rot="Excluído em"><div class="lev-cel">' + new Date(x.excluidoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</div></td>' +
            '<td data-rot="Relatório"><div class="lev-cel">' + (x.relatorio ? 'Gerado em ' + dataCurta(x.relatorio) : 'Não gerado') + '</div></td>' +
            '<td class="lev-acoes"><button type="button" class="btn btn-sec" data-acao="restaurar-lev" data-id="' + x.id + '" data-nome="' + esc(nome) + '">Restaurar</button>' +
            '<button type="button" class="btn-link lev-excluir" data-acao="apagar-lev" data-id="' + x.id + '" data-nome="' + esc(nome) + '">Excluir definitivamente</button></td></tr>';
        }).join('') + '</tbody></table></section>' : '';
      alvo.insertAdjacentHTML('afterend', htmlLixeira);
      if (!l.length) { alvo.innerHTML = '<p class="vazio">Nenhum levantamento salvo.</p>'; return; }
      alvo.innerHTML = '<table class="tabela-lev"><thead><tr><th>Empresa</th><th>Visita</th><th>Última alteração</th><th>Respostas</th><th>Relatório</th><th>Anexos</th><th></th></tr></thead><tbody>' +
        l.map((x) => {
          const aberto = x.id === estado.meta.id;
          const nome = x.empresa || 'Empresa não informada';
          return '<tr' + (aberto ? ' class="lev-aberto"' : '') + '>' +
            '<td data-rot="Empresa"><div class="lev-cel"><strong>' + esc(nome) + '</strong>' + (x.fantasia ? '<br><span class="texto-sec">' + esc(x.fantasia) + '</span>' : '') + (aberto ? '<br><span class="lev-tag">Aberto agora</span>' : '') + '</div></td>' +
            '<td data-rot="Visita"><div class="lev-cel">' + dataCurta(x.dataVisita) + '</div></td>' +
            '<td data-rot="Última alteração"><div class="lev-cel">' + (x.atualizadoEm ? new Date(x.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—') + '</div></td>' +
            '<td data-rot="Respostas"><div class="lev-cel">' + x.respondidas + '</div></td>' +
            '<td data-rot="Relatório"><div class="lev-cel">' + (x.relatorio ? 'Gerado em ' + dataCurta(x.relatorio) : 'Não gerado') + '</div></td>' +
            '<td data-rot="Anexos"><div class="lev-cel">' + x.anexos + '</div></td>' +
            '<td class="lev-acoes"><button type="button" class="btn btn-sec" data-acao="abrir-lev" data-id="' + x.id + '">' + (aberto ? 'Continuar' : 'Abrir') + '</button>' +
            '<button type="button" class="btn-link" data-acao="exportar-lev" data-id="' + x.id + '">Exportar</button>' +
            '<button type="button" class="btn-link lev-excluir" data-acao="excluir-lev" data-id="' + x.id + '" data-nome="' + esc(nome) + '" title="Mover para a lixeira">' + ICONE_LIXEIRA + '<span>Excluir</span></button></td></tr>';
        }).join('') + '</tbody></table>';
    });
  }

  /* ================= Fotos e documentos ================= */
  const TAM_MAX = 30 * 1024 * 1024;
  let urlsAnexos = [];

  function tamanhoTxt(n) {
    n = Number(n) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }
  const ehImagem = (a) => /^image\//.test(a.tipo || '');
  function extensao(nome) { const m = /\.([a-z0-9]{1,5})$/i.exec(nome || ''); return m ? m[1].toUpperCase() : 'ARQ'; }

  function renderAnexos(etapaId) {
    const lista = estado.anexos.filter((a) => a.etapa === etapaId);
    return '<section class="painel anexos-painel"><h2 class="painel-tit">Fotos e documentos <span class="painel-cont">' + lista.length + '</span></h2>' +
      '<p class="texto-sec">Fotos da visita, planilhas, documentos e outros arquivos que ajudem a entender o processo. Ficam guardados neste aparelho junto com o levantamento.</p>' +
      (lista.length ? '<div class="anexos-lista">' + lista.map((a) =>
        '<div class="anexo">' +
        '<div class="anexo-previa">' + (ehImagem(a) ? '<img alt="" data-anexo-img="' + a.id + '">' : '<span class="anexo-ext">' + esc(extensao(a.nome)) + '</span>') + '</div>' +
        '<div class="anexo-info"><span class="anexo-nome">' + esc(a.nome) + '</span><span class="texto-sec">' + tamanhoTxt(a.tamanho) + ' · ' + dataCurta(a.criadoEm) + '</span>' +
        '<input type="text" aria-label="Descrição do anexo" placeholder="Descrição: o que mostra e por que ajuda" data-path="anexos.#' + a.id + '.descricao" value="' + esc(a.descricao) + '"></div>' +
        '<div class="anexo-btns"><a class="btn-link" data-anexo-link="' + a.id + '" target="_blank" rel="noopener" download="' + esc(a.nome) + '">Abrir</a>' +
        '<button type="button" class="btn-link" data-acao="remover-anexo" data-id="' + a.id + '">Remover</button></div></div>').join('') + '</div>' : '') +
      '<div class="anexos-acoes">' +
      '<label class="btn btn-sec">Tirar foto<input class="arquivo-oculto" type="file" accept="image/*" capture="environment" data-anexar="' + etapaId + '"></label>' +
      '<label class="btn btn-sec">Anexar arquivo<input class="arquivo-oculto" type="file" multiple data-anexar="' + etapaId + '"></label>' +
      '</div></section>';
  }

  /* Carrega miniaturas e links dos anexos visíveis. */
  function carregarAnexosVisiveis() {
    urlsAnexos.forEach((u) => URL.revokeObjectURL(u));
    urlsAnexos = [];
    const ids = new Set();
    principal.querySelectorAll('[data-anexo-img],[data-anexo-link]').forEach((el) => ids.add(el.dataset.anexoImg || el.dataset.anexoLink));
    ids.forEach((id) => {
      A.lerArquivo(id).then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        urlsAnexos.push(url);
        principal.querySelectorAll('[data-anexo-img="' + id + '"]').forEach((img) => { img.src = url; });
        principal.querySelectorAll('[data-anexo-link="' + id + '"]').forEach((a) => { a.href = url; });
      }).catch(() => {});
    });
  }

  /* Reduz fotos grandes da câmera (até 1600 px, JPEG) para economizar espaço. */
  async function reduzirImagem(arq) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(arq.type) || !window.createImageBitmap) return arq;
    try {
      const bmp = await createImageBitmap(arq, { imageOrientation: 'from-image' });
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      if (k === 1 && arq.size < 1500000) return arq;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob || blob.size >= arq.size) return arq;
      return new File([blob], (arq.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) {
      return arq;
    }
  }

  async function anexarArquivos(input) {
    const arquivos = Array.from(input.files || []);
    input.value = '';
    if (!arquivos.length) return;
    const etapa = input.dataset.anexar;
    let falhas = 0;
    for (const original of arquivos) {
      if (original.size > TAM_MAX) { alert('“' + original.name + '” tem mais de 30 MB e não foi anexado.'); continue; }
      mostrarStatus('Anexando ' + original.name + '…');
      const arq = await reduzirImagem(original);
      const id = R.uid();
      try {
        await A.salvarArquivo(id, arq);
      } catch (e) {
        falhas++;
        continue;
      }
      const nome = original.name && !/^image\.(jpg|jpeg)$/i.test(original.name) ? (arq.name || original.name) : 'Foto ' + new Date().toLocaleString('pt-BR').replace(/[/:]/g, '-') + '.jpg';
      estado.anexos.push({ id, etapa, nome, tipo: arq.type || original.type || 'application/octet-stream', tamanho: String(arq.size), descricao: '', criadoEm: new Date().toISOString() });
    }
    marcarRespostaAlterada('anexos');
    sujo = true; agendarSalvar(); salvarAgora(true);
    const y = window.scrollY; render(); window.scrollTo(0, y);
    if (falhas) mostrarStatus('Não foi possível guardar ' + falhas + ' arquivo(s): espaço do navegador insuficiente.', true);
  }

  /* ================= Início ================= */
  marcarHistorico();
  render();
  if (R.erroCarregar && R.recuperadoDe === 'anterior') {
    mostrarStatus('A cópia principal estava ilegível; o levantamento foi recuperado da versão anterior salva.', true);
  } else if (R.erroCarregar) {
    mostrarStatus('Os dados salvos neste navegador estavam ilegíveis. Uma cópia foi preservada e um levantamento vazio foi aberto.', true);
  } else if (A.existeSalvo()) {
    mostrarStatus('Levantamento recuperado. Última alteração às ' + hora(new Date(estado.meta.atualizadoEm)));
  }
  if (!navigator.onLine) mostrarStatus('Sem internet. O preenchimento continua sendo salvo neste aparelho.', true);

  /* Se o espelho no IndexedDB ou a versão anterior forem mais recentes (armazenamento cheio ou apagado), recupera. */
  A.recuperarMaisRecente(estado, A.existeSalvo()).then((c) => {
    if (!c || sujo) return;
    estado = c.estado;
    baseSalva = (A.marca() || {}).em || '';
    sujo = true;
    salvarAgora(true);
    marcarHistorico();
    render();
    mostrarStatus('Levantamento recuperado da cópia de segurança do navegador (' + (c.origem === 'espelho' ? 'IndexedDB' : 'versão anterior') + ').', true);
  });
  A.pedirPersistencia();

  /* Funcionamento sem internet quando publicado (não se aplica ao abrir o arquivo direto). */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
