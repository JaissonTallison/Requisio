/* Requisio — interface, navegação, salvamento automático, importação e exportação */
(function () {
  'use strict';
  const R = window.Requisio;
  const A = R.armazenamento;

  let estado = A.carregar();

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

  function agendarSalvar() {
    sujo = true;
    estado.meta.atualizadoEm = new Date().toISOString();
    mostrarStatus('Salvando…');
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(salvarAgora, 300);
  }

  function salvarAgora() {
    clearTimeout(timerSalvar);
    if (!sujo) return;
    const ok = A.salvar(estado);
    sujo = !ok;
    if (ok) mostrarStatus('Salvo automaticamente às ' + hora(new Date()));
    else mostrarStatus('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte o JSON para não perder dados.', true);
  }

  window.addEventListener('pagehide', salvarAgora);
  window.addEventListener('beforeunload', salvarAgora);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvarAgora(); });

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
    et.perguntas.forEach((p) => { total++; if (temTexto(estado.respostas[p.id] && estado.respostas[p.id].texto)) feitas++; });
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
        const ativo = e.id === estado.etapaAtual;
        return '<li><button type="button" class="nav-item' + (ativo ? ' ativo' : '') + '" data-acao="ir" data-etapa="' + e.id + '"' + (ativo ? ' aria-current="step"' : '') + '>' +
          '<span class="nav-num">' + (i + 1) + '</span><span class="nav-nome">' + esc(e.titulo) + '</span>' +
          '<span class="nav-cont" data-cont="' + e.id + '">' + (p ? p.feitas + '/' + p.total : textoDiag()) + '</span></button></li>';
      }).join('') + '</ol>';
  }

  function renderPrincipal() {
    let et = etapaPorId(estado.etapaAtual);
    if (!et) { et = R.ETAPAS[0]; estado.etapaAtual = et.id; }
    let corpo;
    if (et.tipo === 'cadastro') corpo = renderCadastro();
    else if (et.tipo === 'diagnostico') corpo = renderDiagnostico();
    else corpo = renderPerguntas(et);
    principal.innerHTML = cabecalho(et) + corpo + rodape(et);
    principal.querySelectorAll('textarea.resposta').forEach(ajustarAltura);
    if (et.tipo === 'diagnostico') R.diagramas.desenhar(principal);
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

  /* Campo de resposta com gravação de voz e marcação de pendência. */
  function campo(o) {
    const rotulo = o.rotuloHtml || '<label class="pergunta-txt" for="' + o.id + '">' + esc(o.rotulo) + '</label>';
    return '<div class="pergunta">' + rotulo +
      (o.ajuda ? '<p class="pergunta-ajuda">' + esc(o.ajuda) + '</p>' : '') +
      '<textarea id="' + o.id + '" class="resposta" rows="' + (o.linhas || 3) + '" data-path="' + o.path + '">' + esc(o.valor) + '</textarea>' +
      '<div class="pergunta-acoes">' + botaoVoz(o.id) +
      '<span class="voz-status" id="vs_' + o.id + '" aria-live="polite"></span>' +
      '<label class="chk"><input type="checkbox" data-path="' + o.pathConf + '"' + (o.conf ? ' checked' : '') + '> Pendente: confirmar depois</label>' +
      '</div></div>';
  }

  function renderPerguntas(et) {
    let h = '';
    if (et.lista) h += '<section class="painel">' + renderLista(et) + '</section>';
    h += '<section class="painel">';
    if (et.lista) h += '<h2 class="painel-tit">Perguntas gerais</h2>';
    h += et.perguntas.map((p) => {
      const r = estado.respostas[p.id] || {};
      return campo({ id: 'r_' + p.id, rotulo: p.q, ajuda: p.ajuda, path: 'respostas.' + p.id + '.texto', valor: r.texto, pathConf: 'respostas.' + p.id + '.confirmar', conf: r.confirmar });
    }).join('');
    h += renderExtras(et) + '</section>';
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
      const corpo = campos.map((f) => {
        const id = 'f_' + x.id + '_' + f.campo;
        if (f.linha) {
          return '<div class="campo campo-linha"><label for="' + id + '">' + esc(f.rotulo) + '</label><input id="' + id + '" type="text" data-path="' + base + '.' + f.campo + '" value="' + esc(x[f.campo]) + '"' + (f.lista ? ' list="' + f.lista + '"' : '') + '></div>';
        }
        return campo({ id, rotulo: f.rotulo, path: base + '.' + f.campo, valor: x[f.campo], pathConf: base + '.' + f.campo + '__confirmar', conf: x[f.campo + '__confirmar'], linhas: 2 });
      });
      const linhas = corpo.filter((c) => c.startsWith('<div class="campo campo-linha"'));
      const textos = corpo.filter((c) => !c.startsWith('<div class="campo campo-linha"'));
      return '<div class="bloco" id="blk_' + x.id + '"><div class="bloco-cab"><span class="bloco-num">' + Sing + ' ' + (i + 1) + '</span>' +
        '<input class="bloco-nome" type="text" aria-label="Nome do ' + sing + '" placeholder="Nome do ' + sing + '" data-path="' + base + '.nome" value="' + esc(x.nome) + '"' + (chave === 'departamentos' ? ' list="dl_dep_sugeridos"' : '') + '>' +
        '<button type="button" class="btn-link" data-acao="remover" data-lista="' + chave + '" data-id="' + x.id + '">Remover</button></div>' +
        '<div class="bloco-corpo"><div class="grade-linhas">' + linhas.join('') + '</div>' + textos.join('') + '</div></div>';
    }).join('');
    h += '<button type="button" class="btn btn-sec" data-acao="add-lista" data-lista="' + chave + '">Adicionar ' + sing + '</button>';
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

  function renderCadastro() {
    const c = estado.cadastro;
    const inp = (k, rot, tipo, obrig) => '<div class="campo"><label for="cad_' + k + '">' + rot + (obrig ? ' <span class="obrig">obrigatório</span>' : '') + '</label>' +
      '<input id="cad_' + k + '" type="' + (tipo || 'text') + '" data-path="cadastro.' + k + '" value="' + esc(c[k]) + '"></div>';
    const portes = ['', 'Microempreendedor individual (MEI)', 'Microempresa', 'Pequena empresa', 'Média empresa', 'Grande empresa'];
    const sel = '<div class="campo"><label for="cad_porte">Porte <span class="obrig">obrigatório</span></label><select id="cad_porte" data-path="cadastro.porte">' +
      portes.map((p) => '<option value="' + esc(p) + '"' + (c.porte === p ? ' selected' : '') + '>' + (p || 'Selecione') + '</option>').join('') +
      (c.porte && !portes.includes(c.porte) ? '<option selected value="' + esc(c.porte) + '">' + esc(c.porte) + '</option>' : '') + '</select></div>';
    return '<section class="painel"><h2 class="painel-tit">Empresa</h2><div class="grade">' +
      inp('empresa', 'Nome ou razão social', 'text', true) + inp('fantasia', 'Nome fantasia') + inp('cnpj', 'CNPJ') +
      inp('ramo', 'Ramo de atuação', 'text', true) + sel + inp('cidade', 'Cidade / UF') + inp('site', 'Site') +
      inp('dataVisita', 'Data da visita', 'date') + inp('consultor', 'Responsável pelo levantamento') +
      '</div></section>' +
      renderPessoas('responsaveis', 'Responsáveis na empresa', [['nome', 'Nome'], ['cargo', 'Cargo'], ['contato', 'Telefone ou e-mail']]) +
      renderPessoas('entrevistados', 'Entrevistados', [['nome', 'Nome'], ['cargo', 'Cargo ou função'], ['departamento', 'Departamento'], ['contato', 'Telefone ou e-mail']]);
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
      return '<section class="diag-secao' + (s.anexo ? ' anexo' : '') + '" id="sec-' + s.id + '"><h2>' + (s.anexo ? '' : numeradas[i] + '. ') + esc(s.titulo) + '</h2>' +
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
  function ir(id) {
    if (!etapaPorId(id)) return;
    salvarPendencias();
    estado.etapaAtual = id;
    agendarSalvar();
    render(true);
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
      if (!confirm('Iniciar um novo levantamento? O atual será apagado deste navegador. Exporte em JSON antes se quiser guardá-lo.')) return;
      R.voz.parar();
      A.backup(estado);
      estado = A.inicial();
      sujo = true; salvarAgora();
      render(true);
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
  function exportar() {
    salvarPendencias();
    salvarAgora();
    const nome = (estado.cadastro.empresa || 'levantamento').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'levantamento';
    const data = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
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

  arquivoImportar.addEventListener('change', () => {
    const arq = arquivoImportar.files && arquivoImportar.files[0];
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      let novo;
      try {
        novo = A.normalizar(JSON.parse(String(leitor.result)));
      } catch (e) {
        alert('Não foi possível importar: ' + (e instanceof SyntaxError ? 'o arquivo não é um JSON válido.' : e.message));
        return;
      }
      const nome = novo.cadastro.empresa || 'sem nome';
      if (!confirm('Importar o levantamento “' + nome + '”? Ele substitui o levantamento aberto neste navegador.')) return;
      R.voz.parar();
      A.backup(estado);
      estado = novo;
      sujo = true;
      salvarAgora();
      render(true);
      mostrarStatus('Levantamento importado e salvo às ' + hora(new Date()));
    };
    leitor.onerror = () => alert('Não foi possível ler o arquivo.');
    leitor.readAsText(arq);
  });

  /* ================= Início ================= */
  render();
  if (R.erroCarregar) {
    mostrarStatus('Os dados salvos neste navegador estavam ilegíveis. Uma cópia foi preservada e um levantamento vazio foi aberto.', true);
  } else if (A.existeSalvo()) {
    mostrarStatus('Levantamento recuperado. Última alteração às ' + hora(new Date(estado.meta.atualizadoEm)));
  }
})();
