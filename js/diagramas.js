/* Requisio — diagramas em Mermaid: construção do código e desenho (carregado sob demanda) */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  /* Texto seguro para rótulos do Mermaid. */
  const lab = (s, max) => String(s || '').replace(/["<>{}[\]()|#;`\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 70);

  /* Fluxo com raias por ator (estilo BPMN simplificado). passos = [[ator, passo], ...] */
  function fluxoRaias(passos) {
    if (!passos.length) return '';
    const atores = [...new Set(passos.map((p) => p[0]))];
    let c = 'flowchart LR\n  inicio((Início))\n  fim((Fim))\n';
    atores.forEach((a, i) => {
      c += '  subgraph L' + i + '["' + lab(a, 40) + '"]\n';
      passos.forEach((p, j) => { if (p[0] === a) c += '    P' + j + '["' + lab(p[1]) + '"]\n'; });
      c += '  end\n';
    });
    c += '  inicio --> P0\n';
    passos.forEach((p, j) => { if (j < passos.length - 1) c += '  P' + j + ' --> P' + (j + 1) + '\n'; });
    c += '  P' + (passos.length - 1) + ' --> fim\n';
    return c;
  }

  /* Fluxo simples a partir do passo a passo informado (AS-IS). */
  function fluxoSimples(etapas) {
    if (!etapas.length) return '';
    let c = 'flowchart TD\n  inicio((Início))\n';
    etapas.forEach((e, i) => { c += '  P' + i + '["' + lab(e) + '"]\n'; });
    c += '  fim((Fim))\n  inicio --> P0\n';
    etapas.forEach((e, i) => { if (i < etapas.length - 1) c += '  P' + i + ' --> P' + (i + 1) + '\n'; });
    return c + '  P' + (etapas.length - 1) + ' --> fim\n';
  }

  /* Casos de uso (UML simplificado em fluxograma). ligacoes = [[ator, funcionalidade], ...] */
  function casosDeUso(sistema, ligacoes) {
    if (!ligacoes.length) return '';
    const atores = [...new Set(ligacoes.map((l) => l[0]))];
    const funcs = [...new Set(ligacoes.map((l) => l[1]))];
    let c = 'flowchart LR\n';
    atores.forEach((a, i) => { c += '  A' + i + '["Ator: ' + lab(a, 40) + '"]\n'; });
    c += '  subgraph S["' + lab(sistema, 50) + '"]\n';
    funcs.forEach((f, i) => { c += '    U' + i + '(["' + lab(f) + '"])\n'; });
    c += '  end\n';
    ligacoes.forEach(([a, f]) => { c += '  A' + atores.indexOf(a) + ' --- U' + funcs.indexOf(f) + '\n'; });
    return c;
  }

  /* Classes conceituais. entidades = [[Nome, [atributos]]], relacoes = [[A, cardA, cardB, B]] */
  function classes(entidades, relacoes) {
    if (!entidades.length) return '';
    const id = (s) => lab(s).replace(/[^A-Za-z0-9_]/g, '');
    let c = 'classDiagram\n';
    entidades.forEach(([n, attrs]) => {
      c += '  class ' + id(n) + ' {\n' + attrs.map((a) => '    ' + id(a) + '\n').join('') + '  }\n';
    });
    relacoes.forEach(([a, ca, cb, b]) => { c += '  ' + id(a) + ' "' + ca + '" --> "' + cb + '" ' + id(b) + '\n'; });
    return c;
  }

  /* Sequência para padrões com integração. */
  const SEQUENCIAS = {
    pagamentos: (aprovador) => 'sequenceDiagram\n' +
      '  actor F as Financeiro\n  participant S as Solução\n  actor A as ' + lab(aprovador || 'Aprovador', 30) + '\n  participant B as Banco\n' +
      '  F->>S: Monta o lote de pagamentos\n  S->>S: Valida beneficiários e valores\n  S->>A: Solicita aprovação\n  A->>S: Aprova o lote\n' +
      '  S->>B: Envia o lote\n  B-->>S: Retorno com pagos e rejeitados\n  S-->>F: Concilia e avisa pendências\n'
  };

  /* Estrutura do grupo: administradora no topo e empresas operacionais abaixo. */
  function organograma(grupo, rotuloPapel) {
    if (!grupo.length) return '';
    const admin = grupo.find((x) => /^administradora/.test(x.papel || ''));
    const ops = grupo.filter((x) => x !== admin);
    let c = 'flowchart TD\n';
    if (admin) {
      c += '  ADM["' + lab(admin.nome, 40) + ' · ' + lab(rotuloPapel(admin.papel), 50) + '"]\n';
      if (admin.papel === 'administradora_operacional') c += '  OPP["Operação própria de ' + lab(admin.nome, 40) + '"]\n  ADM -.->|"mesma empresa, contas separadas"| OPP\n';
    }
    c += '  subgraph OPS["Empresas operacionais"]\n';
    ops.forEach((x, i) => { c += '    E' + i + '["' + lab(x.nome, 40) + (x.areas ? ' · ' + lab(x.areas, 40) : '') + '"]\n'; });
    c += '  end\n';
    if (admin) c += '  ADM -->|"gestão centralizada e prestação de contas"| OPS\n';
    return c;
  }

  function arquitetura(o) {
    let c = 'flowchart LR\n';
    c += '  U["Usuários: ' + lab(o.usuarios || 'perfis a definir', 50) + '"]\n';
    c += '  W["' + (o.mobile ? 'Aplicação web responsiva e uso em celular' : 'Aplicação web') + '"]\n';
    c += '  API["Serviços da aplicação"]\n  AUT["Autenticação e perfis de acesso"]\n  DB[("Banco de dados' + (o.multiempresa ? ' com separação por empresa' : '') + '")]\n';
    c += '  U --> W --> API\n  API --> AUT\n  API --> DB\n';
    (o.integracoes || []).forEach((x, i) => { c += '  X' + i + '["Integração: ' + lab(x, 50) + '"]\n  API --> X' + i + '\n'; });
    if (o.importacao) c += '  IMP["Importação das planilhas atuais"]\n  IMP --> DB\n';
    return c;
  }

  /* ---------- Desenho ---------- */
  let carregando = null;
  function carregarMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (carregando) return carregando;
    carregando = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'lib/mermaid/mermaid.min.js';
      s.onload = () => {
        window.mermaid.initialize({
          startOnLoad: false, securityLevel: 'strict', theme: 'base',
          fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif',
          themeVariables: {
            primaryColor: '#eaf1fb', primaryBorderColor: '#1f5fbf', primaryTextColor: '#172433',
            lineColor: '#43536a', secondaryColor: '#f4f7fa', tertiaryColor: '#ffffff',
            clusterBkg: '#f4f7fa', clusterBorder: '#d3dce7', fontSize: '14px'
          },
          flowchart: { htmlLabels: false, useMaxWidth: true },
          sequence: { useMaxWidth: true }
        });
        ok(window.mermaid);
      };
      s.onerror = () => { carregando = null; falha(new Error('Não foi possível carregar a biblioteca de diagramas.')); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  let seq = 0;
  /* Desenha todos os alvos [data-mermaid] dentro de raiz. */
  async function desenhar(raiz) {
    const alvos = Array.from(raiz.querySelectorAll('[data-mermaid]'));
    if (!alvos.length) return;
    let mm;
    try { mm = await carregarMermaid(); } catch (e) {
      alvos.forEach((el) => { el.innerHTML = '<p class="diag-erro">' + e.message + ' O código do diagrama continua disponível para edição.</p>'; });
      return;
    }
    for (const el of alvos) await desenharUm(mm, el);
  }

  async function desenharUm(mm, el) {
    const codigo = el.dataset.codigo || '';
    if (!codigo.trim()) { el.innerHTML = ''; return; }
    try {
      const { svg } = await mm.render('mmd' + (++seq), codigo);
      el.innerHTML = svg;
      el.classList.remove('com-erro');
    } catch (e) {
      el.innerHTML = '<p class="diag-erro">Não foi possível desenhar este diagrama. Revise o código.</p>';
      el.classList.add('com-erro');
      document.querySelectorAll('#dmmd' + seq).forEach((x) => x.remove());
    }
  }

  async function redesenhar(el) {
    try { await desenharUm(await carregarMermaid(), el); } catch (e) { /* aviso já exibido */ }
  }

  R.diagramas = { fluxoRaias, fluxoSimples, casosDeUso, classes, arquitetura, organograma, SEQUENCIAS, desenhar, redesenhar };
})();
