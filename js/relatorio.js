/*
 * Requisio — relatório de diagnóstico e proposta de solução.
 * Monta as seções a partir do modelo do motor de análise (js/analise.js).
 * Estrutura: secoes[] → grupos[] → itens[]. Grupos podem ser de itens, cabeçalho de
 * departamento, diagrama (Mermaid), validação da solução ou situação das aprovações.
 */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  const t = (s) => (typeof s === 'string' ? s.trim() : '');
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const curto = (id) => (R.PERGUNTAS[id] && R.PERGUNTAS[id].curto) || (R.PERGUNTAS[id] ? R.PERGUNTAS[id].q : id);
  const resumo = (s, max) => { s = t(s).replace(/\s+/g, ' '); return s.length > (max || 90) ? s.slice(0, max || 90).replace(/\s\S*$/, '') + '…' : s; };
  const unicos = (arr) => [...new Set(arr)];

  function gerar(E) {
    const A = R.analise.analisar(E);
    const D = R.diagramas;
    const c = E.cadastro;

    const it = (texto, origem, fonte, extra) => Object.assign({ id: R.uid(), texto, origem, fonte: fonte || '' }, extra || {});
    const G = (titulo, itens, opc) => Object.assign({ id: R.uid(), titulo, nota: '', prefixo: '', comStatus: false, tipo: 'itens', itens: itens || [] }, opc || {});
    const cab = (titulo, nota) => G(titulo, [], { tipo: 'cabecalho', nota: nota || '' });
    const origemDe = (r) => (r.pendente || r.classe === 'vaga' || r.classe === 'desconhecida' ? 'pendente' : 'cliente');
    const doQ = (id, comRotulo) => {
      const r = A.resposta(id);
      if (!r || r.classe === 'vazia') return [];
      const texto = (comRotulo ? curto(id) + ': ' : '') + r.texto + (r.classe === 'vaga' ? ' (resposta vaga: detalhar)' : '');
      return [it(texto, origemDe(r), r.fonte)];
    };
    const st = { status: 'a_validar' };

    const totalPend = A.pendencias.semResposta.length + A.pendencias.vagas.length + A.pendencias.desconhecidas.length +
      A.pendencias.marcadas.length + A.pendencias.divergencias.length;
    const preliminarNota = totalPend ? 'Preliminar: ' + plural(totalPend, 'pendência ainda aberta', 'pendências ainda abertas') + ' no levantamento.' : '';

    const volumeTxt = !A.divergencia && A.volumes[0] ? A.volumes[0].n + ' ' + A.volumes[0].unidade + (A.volumes[0].periodo ? ' por ' + A.volumes[0].periodo : '') : '';
    const aprovadorNome = A.aprovador ? A.aprovador.papel : 'Aprovador';
    const depsComSolucao = A.deps.filter((d) => Object.keys(d.padroes).length);

    function entrega(tipo) {
      if (tipo === 'integracao') return 'Integração';
      if (A.sistemasAtuais.length) return tipo === 'padrao' ? 'Configuração do sistema existente (avaliar aderência)' : 'Customização do sistema existente (avaliar)';
      return tipo === 'padrao' ? 'Sistema de mercado configurado ou desenvolvimento novo' : 'Desenvolvimento novo';
    }
    let depAtual = null;
    const nomeAtor = (a) => (a === 'Aprovador' ? aprovadorNome : a === 'Usuário do departamento' && depAtual ? depAtual.nome : a);
    const evidTxt = (evs) => evs.slice(0, 2).map((e) => '“' + resumo(e.texto, 110) + '” (' + e.fonte + ')').join('; ');

    /* ================= 1. Resumo executivo ================= */
    const resumoItens = [];
    const ident = [t(c.empresa), t(c.fantasia) ? '(' + t(c.fantasia) + ')' : ''].filter(Boolean).join(' ');
    const perfil = [t(c.ramo), t(c.porte) ? 'porte: ' + t(c.porte) : '', t(c.cidade)].filter(Boolean).join(' · ');
    if (ident || perfil) resumoItens.push(it([ident, perfil].filter(Boolean).join(' — ') + '.', 'cliente', 'Cadastro'));
    const rAtiv = A.resposta('emp_atividade');
    if (rAtiv && rAtiv.classe === 'informativa') resumoItens.push(it('Atividade: ' + rAtiv.texto, origemDe(rAtiv), rAtiv.fonte));
    const rMot = A.resposta('emp_motivacao');
    if (rMot && rMot.classe === 'informativa') resumoItens.push(it('Motivação: ' + rMot.texto, origemDe(rMot), rMot.fonte));
    const porTitulo = {};
    A.deps.forEach((d) => Object.values(d.padroes).forEach((p) => { (porTitulo[p.def.titulo] = porTitulo[p.def.titulo] || { def: p.def, deps: [] }).deps.push(d.nome); }));
    Object.values(A.padroesGerais).forEach((p) => { porTitulo[p.def.titulo] = porTitulo[p.def.titulo] || { def: p.def, deps: ['entre áreas'] }; });
    const fmt = (x) => x.def.titulo + ' (' + x.deps.join(', ') + ')';
    const probs = Object.values(porTitulo).filter((x) => !x.def.objetivo_).map(fmt);
    const objs = Object.values(porTitulo).filter((x) => x.def.objetivo_).map(fmt);
    if (probs.length) resumoItens.push(it('Principais problemas identificados: ' + probs.join('; ') + '.', 'inferencia', 'Análise das respostas'));
    if (objs.length) resumoItens.push(it('Objetivos que orientam a solução: ' + objs.join('; ') + '.', 'inferencia', 'Análise das respostas'));
    if (A.deps.length) resumoItens.push(it('Departamentos considerados: ' + A.deps.map((d) => d.nome + (d.origem === 'cadastrado' ? '' : ' (citado)')).join(', ') + '.', 'inferencia', 'Análise das respostas'));
    if (depsComSolucao.length) {
      const tipos = [];
      if (A.semSistema) tipos.push('não há sistema de gestão em uso, então a base da solução é um sistema de mercado configurado ou desenvolvimento novo');
      else if (A.sistemasAtuais.length) tipos.push('há sistemas em uso que devem ser avaliados antes de desenvolver');
      if (depsComSolucao.some((d) => Object.values(d.padroes).some((p) => p.def.integracoes.length))) tipos.push('com integração bancária para pagamentos');
      if (A.multiempresa) tipos.unshift('estrutura multiempresa como base comum (' + A.multiempresa.n + ' empresas' + (A.admin ? ', com ' + t(A.admin.nome) + ' na gestão do grupo e com operação própria separada' : '') + ')');
      resumoItens.push(it('Abordagem recomendada: soluções por departamento (' + depsComSolucao.map((d) => d.nome).join(', ') + ')' + (tipos.length ? '; ' + tipos.join(', ') : '') + '. Entrega por fases, começando pela prioridade informada pelo cliente.', 'recomendacao', 'Análise das respostas'));
    } else {
      resumoItens.push(it('Ainda não há informação suficiente para recomendar uma solução. Completar o levantamento.', 'pendente', ''));
    }
    resumoItens.push(it('Situação: ' + plural(totalPend, 'pendência de confirmação', 'pendências de confirmação') + '. Nenhuma solução é considerada aprovada sem a validação do cliente.', 'pendente', 'Análise das respostas'));
    const resumoSec = { id: 'resumo', titulo: 'Resumo executivo', nota: '', grupos: [G('', resumoItens)] };

    /* ================= 2. Diagnóstico geral ================= */
    const idItens = [];
    const addC = (rot, v) => { if (t(v)) idItens.push(it(rot + ': ' + t(v), 'cliente', 'Cadastro')); };
    addC('Empresa', c.empresa); addC('Nome fantasia', c.fantasia); addC('CNPJ', c.cnpj); addC('Ramo de atuação', c.ramo);
    addC('Porte', c.porte); addC('Localização', c.cidade); addC('Site', c.site);
    if (t(c.dataVisita)) addC('Data da visita', new Date(c.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR'));
    addC('Levantamento conduzido por', c.consultor);
    const pessoa = (p, dep) => [t(p.nome), t(p.cargo), dep ? t(p.departamento) : '', t(p.contato)].filter(Boolean).join(' — ');
    c.responsaveis.filter((p) => t(p.nome)).forEach((p) => idItens.push(it('Responsável: ' + pessoa(p), 'cliente', 'Cadastro')));
    c.entrevistados.filter((p) => t(p.nome)).forEach((p) => idItens.push(it('Entrevistado: ' + pessoa(p, true), 'cliente', 'Cadastro')));

    const interItens = A.interdep.map((x) => it(x.texto + (x.deps.length ? ' — envolve ' + x.deps.join(' e ') : ''), 'cliente', x.fonte));
    const temPad = (id) => A.deps.some((d) => d.padroes[id]);
    if (temPad('contratacao') && temPad('pagamentos')) {
      interItens.push(it('O cadastro de colaboradores (RH) alimenta os pagamentos (Financeiro): as duas soluções devem compartilhar o mesmo cadastro.', 'inferencia', 'Análise das respostas'));
    }
    if (temPad('mensagens')) {
      const ds = A.deps.filter((d) => d.padroes.mensagens).map((d) => d.nome);
      interItens.push(it('A troca de informações entre áreas' + (ds.length ? ' (' + ds.join(', ') + ')' : '') + ' acontece por mensagens, sem registro estruturado.', 'inferencia', 'Análise das respostas'));
    }

    const geralSec = {
      id: 'geral', titulo: 'Diagnóstico geral', nota: '',
      grupos: [
        G('Identificação', idItens),
        G('Contexto do negócio', ['emp_atividade', 'emp_historia', 'emp_clientes', 'emp_unidades', 'emp_volume', 'emp_objetivos', 'emp_motivacao'].flatMap((id) => doQ(id, true))),
        G('Estrutura e decisões', ['org_organograma', 'org_colaboradores', 'org_decisao', 'org_terceiros', 'org_comunicacao'].flatMap((id) => doQ(id, true))),
        G('Sistemas e infraestrutura atuais', ['sis_lista', 'sis_satisfacao', 'sis_planilhas', 'sis_integracoes', 'sis_infra', 'sis_contratos', 'sis_dados'].flatMap((id) => doQ(id, true))),
        G('Processos que envolvem vários departamentos', interItens),
        G('Problemas não associados a um departamento', A.geral.problemas.map((f) => it(f.texto, f.pendente ? 'pendente' : 'cliente', f.fonte)))
      ].filter((g) => g.itens.length)
    };
    const papelTxt = (v) => ((R.PAPEIS_EMPRESA || []).find((x) => x[0] === v) || ['', 'papel não definido'])[1];
    if (A.grupo.length >= 2) {
      const itensGrupo = A.grupo.map((x) => it([t(x.nome) + ' — ' + papelTxt(x.papel), t(x.areas) ? 'Áreas: ' + t(x.areas) : '', t(x.cnpj) ? 'CNPJ: ' + t(x.cnpj) : '', t(x.obs)].filter(Boolean).join('\n'),
        x.confirmar || !x.papel ? 'pendente' : 'cliente', 'Cadastro › Empresas do grupo'));
      if (!A.admin) itensGrupo.push(it('Empresa administradora não definida.', 'pendente', 'Cadastro › Empresas do grupo'));
      if (A.admin && A.admin.papel === 'administradora_operacional') itensGrupo.push(it(t(A.admin.nome) + ' tem duas visões: gestão do grupo e operação própria. As movimentações próprias não podem se misturar com as das outras empresas.', 'inferencia', 'Cadastro › Empresas do grupo'));
      geralSec.grupos.splice(1, 0,
        G('Estrutura do grupo', itensGrupo),
        G('Diagrama do grupo', [], { tipo: 'diagrama', codigo: R.diagramas.organograma(A.grupo, papelTxt), preliminar: A.grupo.some((x) => x.confirmar || !x.papel), nota: 'Baseado no cadastro das empresas.', nivel: 4 }));
      const deps = E.departamentos.filter((d) => t(d.nome));
      if (deps.length) {
        const onde = (v) => ((R.ONDE_FUNCIONA || []).find((x) => x[0] === v) || ['', ''])[1];
        geralSec.grupos.splice(3, 0, G('Departamentos e empresas', deps.map((d) => it(t(d.nome) + ': ' + (d.onde ? onde(d.onde) : 'onde funciona no grupo não definido'), d.onde ? 'cliente' : 'pendente', 'Departamentos'))));
      }
    } else if (A.multiempresa) {
      geralSec.grupos.splice(2, 0, G('Estrutura societária', [it('Operação com ' + A.multiempresa.n + ' empresas, conforme “' + resumo(A.multiempresa.texto) + '”. A solução precisa separar os dados por empresa e permitir visão consolidada.', 'inferencia', A.multiempresa.fonte)]));
    }

    /* ================= 3. Diagnóstico por departamento ================= */
    const depSec = { id: 'departamentos', titulo: 'Diagnóstico por departamento', nota: 'Cada departamento reúne o que foi informado sobre ele. Frases associadas pelo assunto (sem citar o departamento) indicam isso na fonte.', grupos: [] };
    A.deps.forEach((d) => {
      const temConteudo = d.fatos.length || d.problemas.length || d.processos.length || Object.keys(d.padroes).length || d.requisitos.length || d.responsaveis.length;
      if (!temConteudo && d.origem !== 'cadastrado') return;
      depSec.grupos.push(cab(d.nome, d.origem === 'cadastrado' ? 'Departamento cadastrado na entrevista.' : 'Departamento citado nas respostas, sem cadastro detalhado.'));
      const situacao = d.fatos.filter((f) => !d.problemas.includes(f)).map((f) => it(f.texto, f.pendente ? 'pendente' : 'cliente', f.fonte + (f.modo === 'tema' ? ' (associado pelo assunto)' : '')));
      depSec.grupos.push(G('Situação atual', situacao.length ? situacao : [it('Situação atual da área não descrita na entrevista.', 'pendente', '')], { nivel: 4 }));
      depSec.grupos.push(G('Responsáveis', d.responsaveis.length ? d.responsaveis.map((r) => it(r.texto, r.pendente ? 'pendente' : 'cliente', 'Cadastro')) : [it('Responsável pela área não informado.', 'pendente', '')], { nivel: 4 }));
      const procItens = d.processos.map((p) => it(p.nome + (p.etapas.length ? ':\n' + p.etapas.map((e, i) => (i + 1) + '. ' + e).join('\n') : ': passo a passo não informado.'), p.etapas.length ? 'cliente' : 'pendente', 'Processos › ' + p.nome));
      depSec.grupos.push(G('Processos atuais (AS-IS)', procItens.length ? procItens : [it('Nenhum processo da área mapeado passo a passo.', 'pendente', '')], { nivel: 4 }));
      const probItens = d.problemas.map((f) => it(f.texto, f.pendente ? 'pendente' : 'cliente', f.fonte + (f.modo === 'tema' ? ' (associado pelo assunto)' : '')));
      Object.values(d.padroes).forEach((p) => {
        probItens.push(it(p.def.titulo + '.\n' + (p.def.objetivo_ ? 'Lacuna provável: ' : 'Causa provável: ') + p.def.causa + '\nImpacto: ' + p.def.impacto +
          (p.def.id === 'pagamentos' && A.volumes.length ? '\nVolume informado: ' + unicos(A.volumes.map((v) => v.trecho)).join('; ') + (A.divergencia ? ' (valores divergentes: confirmar).' : '.') : '') +
          '\nEvidência: ' + evidTxt(p.evidencias), 'inferencia', 'Análise das respostas'));
      });
      if (probItens.length) depSec.grupos.push(G('Problemas, causas e impactos', probItens, { nivel: 4 }));
      if (d.prioridades.length) depSec.grupos.push(G('Prioridade', d.prioridades.map((p) => it('Prioridade ' + p.ordem + ' informada pelo cliente: ' + p.texto, p.pendente ? 'pendente' : 'cliente', p.fonte)), { nivel: 4 }));
    });
    if (!depSec.grupos.length) depSec.grupos.push(G('', [it('Nenhum departamento identificado. Cadastre os departamentos ou descreva a estrutura organizacional.', 'pendente', '')]));

    /* ================= 4. Processos atuais e futuros ================= */
    const procSec = { id: 'processos', titulo: 'Processos atuais e futuros', nota: 'O AS-IS usa apenas o que o cliente descreveu. O TO-BE é uma recomendação a desenhar e validar com o cliente.', grupos: [] };
    depsComSolucao.forEach((d) => {
      depAtual = d;
      procSec.grupos.push(cab(d.nome));
      const asis = d.processos.filter((p) => p.etapas.length).map((p) => it(p.nome + ':\n' + p.etapas.map((e, i) => (i + 1) + '. ' + e).join('\n'), 'cliente', 'Processos › ' + p.nome));
      Object.values(d.padroes).forEach((p) => p.evidencias.filter((e) => e.atual !== false).slice(0, 2).forEach((e) => asis.push(it(resumo(e.texto, 160), 'cliente', e.fonte))));
      procSec.grupos.push(G('Como funciona hoje (AS-IS)', unicosItens(asis).length ? unicosItens(asis) : [it('Situação atual não descrita: passo a passo não informado.', 'pendente', '')], { nivel: 4, nota: d.processos.some((p) => p.etapas.length) ? '' : 'Passo a passo não mapeado; abaixo, o que o cliente relatou sobre a situação atual.' }));
      Object.values(d.padroes).forEach((p) => {
        procSec.grupos.push(G('Como deve funcionar (TO-BE) — ' + p.def.titulo, p.def.tobe.map(([ator, passo]) => it(nomeAtor(ator) + ': ' + passo, 'recomendacao', 'Recomendação')), { nivel: 4, prefixo: 'Passo ', nota: preliminarNota }));
      });
    });
    depAtual = null;
    if (interItens.length) procSec.grupos.push(cab('Entre departamentos'), G('Dependências entre áreas', interItens.map((x) => Object.assign({}, x, { id: R.uid() })), { nivel: 4 }));
    if (!procSec.grupos.length) procSec.grupos.push(G('', [it('Nenhum processo com informação suficiente para AS-IS e TO-BE.', 'pendente', '')]));

    function unicosItens(itens) {
      const vistos = new Set();
      return itens.filter((i) => { const k = i.texto; if (vistos.has(k)) return false; vistos.add(k); return true; });
    }

    /* ================= 5. Soluções propostas ================= */
    const solSec = { id: 'solucoes', titulo: 'Soluções propostas', nota: 'Propostas preliminares e independentes de produto. Cada solução precisa ser aprovada pelo cliente; nenhuma é aprovada automaticamente.', grupos: [] };
    const prazoRisco = A.prazoDias != null && A.prazoDias <= 30;
    depsComSolucao.forEach((d) => {
      depAtual = d;
      const pads = Object.values(d.padroes);
      solSec.grupos.push(cab(d.nome, 'Entrega sugerida: ' + unicos(pads.flatMap((p) => p.def.funcionalidades.map((f) => entrega(f[1])))).join(' · ')));
      solSec.grupos.push(G('Problema que será resolvido', pads.map((p) => it(p.def.titulo + '. ' + p.def.causa + '\nEvidência: ' + evidTxt(p.evidencias), 'inferencia', 'Análise das respostas')), { nivel: 4 }));
      solSec.grupos.push(G('Objetivo da solução', pads.map((p) => it(p.def.objetivo, 'recomendacao', p.def.titulo)), { nivel: 4 }));
      solSec.grupos.push(G('Como funcionará o processo futuro', pads.map((p) => it(p.def.solucao, 'recomendacao', p.def.titulo)), { nivel: 4 }));
      const funcs = [];
      pads.forEach((p) => p.def.funcionalidades.forEach(([nome, tipo]) => {
        if (!funcs.some((f) => f.texto.startsWith(nome))) funcs.push(it(nome + '\nEntrega: ' + entrega(tipo), 'recomendacao', p.def.titulo, st));
      }));
      d.requisitos.forEach((r) => funcs.push(it('Pedido do cliente — ' + (r.qid === 'req_relatorios' ? 'relatórios: ' : '') + r.texto + (r.vaga ? ' (detalhar)' : ''), r.pendente ? 'pendente' : 'cliente', r.fonte, st)));
      solSec.grupos.push(G('Módulos e funcionalidades', funcs, { nivel: 4, prefixo: 'F', comStatus: true }));
      const perms = {};
      pads.forEach((p) => p.def.atores.forEach(([a, perm]) => { const n = nomeAtor(a); (perms[n] = perms[n] || []).push(perm); }));
      const atores = Object.entries(perms).map(([n, ps]) => it(n + ': ' + unicos(ps).join('; ') + '.', 'recomendacao', 'Recomendação'));
      if (A.aprovador && pads.some((p) => p.def.atores.some((a) => a[0] === 'Aprovador'))) atores.push(it('Aprovador indicado: ' + A.aprovador.papel + ', conforme “' + resumo(A.aprovador.texto) + '”.', 'inferencia', A.aprovador.fonte));
      d.responsaveis.forEach((r) => atores.push(it(r.texto, r.pendente ? 'pendente' : 'cliente', 'Cadastro')));
      solSec.grupos.push(G('Atores e permissões', atores, { nivel: 4 }));
      const regras = d.regras.map((r) => it(r.texto + (r.vaga ? ' (resposta vaga: detalhar)' : ''), r.pendente ? 'pendente' : 'cliente', r.fonte, st));
      pads.forEach((p) => p.def.perguntas.forEach((q) => regras.push(it('A definir com o cliente: ' + q, 'pendente', p.def.titulo))));
      solSec.grupos.push(G('Regras de negócio', regras.length ? regras : [it('Nenhuma regra de negócio específica informada para esta área.', 'pendente', '')], { nivel: 4 }));
      const integ = unicos(pads.flatMap((p) => p.def.integracoes)).map((x) => it(x, 'recomendacao', 'Análise das respostas'));
      solSec.grupos.push(G('Integrações', integ.length ? integ : [it('Nenhuma integração identificada para esta área.', 'inferencia', '')], { nivel: 4 }));
      const crit = [];
      pads.forEach((p) => p.def.criterios({ volume: volumeTxt }).forEach((x) => crit.push(it(x, 'recomendacao', p.def.titulo))));
      solSec.grupos.push(G('Critérios de aceitação', crit, { nivel: 4, prefixo: 'CA' }));
      const riscos = unicos(pads.flatMap((p) => p.def.riscos)).map((x) => it(x, 'inferencia', 'Análise das respostas'));
      if (prazoRisco) riscos.push(it('Prazo informado (' + A.resposta('sol_prazo').texto + ') é curto para o escopo identificado; recomenda-se entregar por fases.', 'inferencia', A.resposta('sol_prazo').fonte));
      if (A.divergencia && pads.some((p) => p.def.id === 'pagamentos')) riscos.push(it('Volumes de pagamento divergentes nas respostas; o dimensionamento depende do volume real.', 'pendente', 'Análise das respostas'));
      solSec.grupos.push(G('Dependências e riscos', riscos.length ? riscos : [it('Nenhum risco específico identificado.', 'inferencia', '')], { nivel: 4 }));
      solSec.grupos.push(G('Validação da solução', [], { tipo: 'validacao', chave: d.chave, nivel: 4 }));
    });
    A.deps.filter((d) => !Object.keys(d.padroes).length && (d.fatos.length || d.origem === 'cadastrado' || d.requisitos.length)).forEach((d) => {
      solSec.grupos.push(cab(d.nome), G('Situação', [it('Informações insuficientes para propor solução para ' + d.nome + '. Levantar processos e problemas da área.', 'pendente', '')]
        .concat(d.requisitos.map((r) => it(r.texto + (r.vaga ? ' (detalhar)' : ''), r.pendente ? 'pendente' : 'cliente', r.fonte, st))), { nivel: 4, comStatus: d.requisitos.length > 0 }));
    });
    if (A.multiempresa) {
      const nomeAdm = A.admin ? t(A.admin.nome) : 'a administradora';
      const respG = (id) => { const r = A.resposta(id); return r && r.classe !== 'vazia' ? [it(curto(id) + ': ' + r.texto, origemDe(r), r.fonte)] : []; };
      solSec.grupos.push(cab('Estrutura multiempresa', 'Base comum a todas as soluções: ' + A.multiempresa.n + ' empresas com dados separados e visão consolidada.'));
      solSec.grupos.push(G('Problema que será resolvido', [it('Operação com ' + A.multiempresa.n + ' empresas' + (A.admin ? ', sendo ' + nomeAdm + ' a administradora' : '') + '. Sem separação estruturada, as movimentações de uma empresa se misturam com as das outras e a consolidação do grupo é manual.', 'inferencia', A.multiempresa.fonte)].concat(respG('grp_segregacao'), respG('grp_admin_receita')), { nivel: 4 }));
      solSec.grupos.push(G('Objetivo da solução', [it('Cada empresa com seus próprios registros, contas, contratos e pessoal; ' + nomeAdm + ' com duas visões separadas: gestão do grupo e operação própria.', 'recomendacao', 'Estrutura multiempresa')], { nivel: 4 }));
      const fm = [['Cadastro das empresas do grupo e do papel de cada uma', 'padrao'], ['Separação de todos os registros por empresa', 'padrao'], ['Visão da administradora: gestão do grupo separada da operação própria', 'especifica'], ['Relatórios por empresa e consolidados do grupo', 'padrao'], ['Perfis de acesso por empresa', 'padrao'], ['Registro de transações entre empresas (repasses, rateios, taxa de administração, pessoal compartilhado)', 'especifica']];
      solSec.grupos.push(G('Módulos e funcionalidades', fm.map(([f, tp]) => it(f + '\nEntrega: ' + entrega(tp), 'recomendacao', 'Estrutura multiempresa', st)), { nivel: 4, prefixo: 'F', comStatus: true }));
      solSec.grupos.push(G('Atores e permissões', [it('Gestão do grupo (' + nomeAdm + '): vê e consolida todas as empresas.', 'recomendacao', 'Estrutura multiempresa'), it('Usuários de cada empresa: veem e registram apenas os dados da sua empresa.', 'recomendacao', 'Estrutura multiempresa')].concat(respG('grp_acessos')), { nivel: 4 }));
      const rgm = respG('grp_cobranca').concat(respG('grp_intercompany'), respG('grp_decisoes'));
      ['grp_cobranca', 'grp_intercompany', 'grp_consolidado'].forEach((id) => { const r = A.resposta(id); if (!r || r.classe === 'vazia') rgm.push(it('A definir com o cliente: ' + R.PERGUNTAS[id].q, 'pendente', 'Estrutura multiempresa')); });
      solSec.grupos.push(G('Regras de negócio', rgm, { nivel: 4 }));
      solSec.grupos.push(G('Critérios de aceitação', [
        'Os lançamentos de ' + nomeAdm + ' como empresa operacional não aparecem nos números das outras empresas, e vice-versa.',
        'O relatório consolidado soma as ' + A.multiempresa.n + ' empresas e permite abrir cada uma separadamente.',
        'Transações entre empresas aparecem nas duas empresas envolvidas e são identificadas no consolidado.',
        'Um usuário de uma empresa operacional não acessa dados de outra empresa.'
      ].map((x) => it(x, 'recomendacao', 'Estrutura multiempresa')), { nivel: 4, prefixo: 'CA' }));
      solSec.grupos.push(G('Dependências e riscos', [it('Rateios, taxa de administração e pessoal compartilhado precisam de regra definida antes do desenvolvimento.', 'inferencia', 'Estrutura multiempresa'), it('Se a contabilidade for externa, alinhar com o contador a forma de separar e consolidar.', 'inferencia', 'Estrutura multiempresa')], { nivel: 4 }));
      solSec.grupos.push(G('Validação da solução', [], { tipo: 'validacao', chave: 'multiempresa', nivel: 4 }));
    }
    const transv = Object.values(A.padroesGerais);
    if (transv.length) {
      solSec.grupos.push(cab('Entre departamentos', 'Necessidades que envolvem várias áreas.'));
      solSec.grupos.push(G('Problema que será resolvido', transv.map((p) => it(p.def.titulo + '. ' + p.def.causa + '\nEvidência: ' + evidTxt(p.evidencias), 'inferencia', 'Análise das respostas')), { nivel: 4 }));
      solSec.grupos.push(G('Como funcionará', transv.map((p) => it(p.def.solucao, 'recomendacao', p.def.titulo)), { nivel: 4 }));
      solSec.grupos.push(G('Módulos e funcionalidades', transv.flatMap((p) => p.def.funcionalidades.map(([f, tipo]) => it(f + '\nEntrega: ' + entrega(tipo), 'recomendacao', p.def.titulo, st))), { nivel: 4, prefixo: 'F', comStatus: true }));
      solSec.grupos.push(G('Critérios de aceitação', transv.flatMap((p) => p.def.criterios({}).map((x) => it(x, 'recomendacao', p.def.titulo))), { nivel: 4, prefixo: 'CA' }));
      solSec.grupos.push(G('Regras de negócio', transv.flatMap((p) => p.def.perguntas.map((q) => it('A definir com o cliente: ' + q, 'pendente', p.def.titulo))), { nivel: 4 }));
      solSec.grupos.push(G('Validação da solução', [], { tipo: 'validacao', chave: 'entre_departamentos', nivel: 4 }));
    }
    depAtual = null;
    if (!solSec.grupos.length) solSec.grupos.push(G('', [it('Nenhuma solução proposta: faltam informações sobre processos e problemas.', 'pendente', '')]));

    /* ================= 6. Diagramas ================= */
    const diaSec = { id: 'diagramas', titulo: 'Diagramas', nota: 'Diagramas em Mermaid, editáveis. São fundamentados nas respostas; os de solução são recomendações.' + (preliminarNota ? ' ' + preliminarNota : ''), grupos: [] };
    const dia = (titulo, codigo, preliminar, nota) => G(titulo, [], { tipo: 'diagrama', codigo, preliminar: !!preliminar, nota: nota || '', nivel: 4 });
    depsComSolucao.forEach((d) => {
      depAtual = d;
      const pads = Object.values(d.padroes);
      diaSec.grupos.push(cab(d.nome));
      const procAs = d.processos.find((p) => p.etapas.length > 1);
      if (procAs) diaSec.grupos.push(dia('Fluxo AS-IS — ' + procAs.nome, D.fluxoSimples(procAs.etapas), !!totalPend, 'Baseado no passo a passo informado pelo cliente.'));
      else diaSec.grupos.push(G('Fluxo AS-IS', [it('Fluxo atual não desenhado: o passo a passo do processo não foi informado.', 'pendente', '')], { nivel: 4 }));
      pads.forEach((p) => diaSec.grupos.push(dia('Fluxo TO-BE — ' + p.def.titulo, D.fluxoRaias(p.def.tobe.map(([a, s]) => [nomeAtor(a), s])), true, 'Recomendação do sistema, com raias por responsável.')));
      pads.forEach((p) => {
        const lig = [];
        const principal = nomeAtor(p.def.atores[0][0]);
        p.def.funcionalidades.forEach(([f, tipo]) => {
          if (/aprova/i.test(f) && p.def.atores.some((a) => a[0] === 'Aprovador')) lig.push([aprovadorNome, f]);
          else lig.push([principal, f]);
          if (tipo === 'integracao') lig.push(['Banco', f]);
        });
        diaSec.grupos.push(dia('Casos de uso — ' + p.def.titulo, D.casosDeUso(p.def.titulo, lig), true));
      });
      const ents = [], rels = [], raizes = [];
      pads.forEach((p) => {
        p.def.entidades.forEach((e, i) => { if (!ents.some((x) => x[0] === e[0])) { ents.push(e); if (i === 0) raizes.push(e[0]); } });
        rels.push(...p.def.relacoes);
      });
      if (ents.length) {
        if (A.multiempresa) { ents.unshift(['Empresa', ['razaoSocial', 'cnpj']]); raizes.forEach((r) => rels.unshift(['Empresa', '1', '*', r])); }
        diaSec.grupos.push(dia('Classes conceituais', D.classes(ents, rels), true, 'Modelo conceitual; atributos a confirmar.'));
      }
      pads.forEach((p) => { if (D.SEQUENCIAS[p.def.id]) diaSec.grupos.push(dia('Sequência — ' + p.def.titulo, D.SEQUENCIAS[p.def.id](aprovadorNome), true)); });
    });
    depAtual = null;

    /* ================= 7. Requisitos e regras de negócio ================= */
    const rf = A.reqGeral.filter((r) => r.tipo === 'RF').map((r) => it((r.qid === 'req_relatorios' ? 'Relatórios: ' : '') + r.texto + (r.deps.length ? ' — ' + r.deps.join(', ') : '') + (r.vaga ? ' (resposta vaga: detalhar)' : ''), r.pendente ? 'pendente' : 'cliente', r.fonte, st));
    const rnf = A.reqGeral.filter((r) => r.tipo === 'RNF').map((r) => {
      const txt = curto(r.qid) + ': ' + r.texto + (r.negativa ? ' (cliente informou que não há exigência)' : '') + (r.vaga ? ' (resposta vaga: detalhar)' : '');
      return it(txt, r.pendente ? 'pendente' : 'cliente', r.fonte, st);
    });
    const rni = [];
    if (A.multiempresa) rni.push(it('Separação dos dados por empresa (' + A.multiempresa.n + ' empresas) com visão consolidada da controladora.', 'inferencia', A.multiempresa.fonte, st));
    if (temPad('pagamentos') || temPad('contratacao')) rni.push(it('Proteção de dados pessoais (nome, documento, chave PIX) conforme a LGPD, com controle de acesso e registro de quem consultou ou alterou.', 'inferencia', 'Análise das respostas', st));
    if (A.aprovador || temPad('pagamentos')) rni.push(it('Perfis de acesso que separem quem registra de quem aprova.', 'inferencia', 'Análise das respostas', st));
    if (temPad('pagamentos')) rni.push(it('Registro de auditoria de lotes, aprovações e envios ao banco.', 'inferencia', 'Análise das respostas', st));
    const rn = A.regrasGerais.map((r) => it(r.texto + (r.vaga ? ' (resposta vaga: detalhar quais)' : ''), r.pendente ? 'pendente' : 'cliente', r.fonte, st))
      .concat(A.deps.flatMap((d) => d.regras.filter((r) => /^Processos/.test(r.fonte)).map((r) => it(r.texto, r.pendente ? 'pendente' : 'cliente', r.fonte, st))));
    const reqSec = {
      id: 'requisitos', titulo: 'Requisitos e regras de negócio',
      nota: 'Somente itens com situação “Aprovado” são requisitos aprovados. As funcionalidades recomendadas ficam em Soluções propostas, com situação própria.',
      grupos: [
        G('Requisitos funcionais informados pelo cliente', rf.length ? rf : [it('Nenhum requisito funcional informado.', 'pendente', '', st)], { prefixo: 'RF', comStatus: true }),
        G('Requisitos não funcionais informados pelo cliente', rnf.length ? rnf : [it('Nenhum requisito não funcional informado.', 'pendente', '', st)], { prefixo: 'RNF', comStatus: true }),
        G('Requisitos não funcionais inferidos', rni, { prefixo: 'RNI', comStatus: true, nota: 'Inferidos das respostas; precisam ser confirmados.' }),
        G('Regras de negócio', rn.length ? rn : [it('Nenhuma regra de negócio informada.', 'pendente', '', st)], { prefixo: 'RN', comStatus: true })
      ].filter((g) => g.itens.length)
    };

    /* ================= 8. Arquitetura sugerida ================= */
    const integracoes = unicos(A.deps.flatMap((d) => Object.values(d.padroes).flatMap((p) => p.def.integracoes)));
    const rAcesso = A.resposta('req_acesso');
    const mobile = !!(rAcesso && /celular|campo|externo|mobile|tablet|remot/.test(R.analise.norm(rAcesso.texto)));
    const rUsu = A.resposta('req_usuarios');
    const arqItens = [];
    if (depsComSolucao.length) {
      arqItens.push(it('Aplicação web' + (mobile ? ' responsiva, com uso em celular' : '') + ' acessada pelo navegador' + (rAcesso && rAcesso.classe === 'informativa' ? ' (uso informado: ' + rAcesso.texto + ')' : '') + '.', 'recomendacao', 'Análise das respostas'));
      arqItens.push(it('Serviços da aplicação com autenticação e perfis de acesso por departamento' + (A.aprovador ? ' e papel de aprovador' : '') + '.', 'recomendacao', 'Análise das respostas'));
      arqItens.push(it('Banco de dados relacional único' + (A.multiempresa ? ', com separação por empresa' : '') + '.', 'recomendacao', 'Análise das respostas'));
      integracoes.forEach((x) => arqItens.push(it('Integração: ' + x, 'recomendacao', 'Análise das respostas')));
      if (temPad('planilha')) arqItens.push(it('Importação inicial das planilhas atuais.', 'recomendacao', 'Análise das respostas'));
      arqItens.push(it('Hospedagem, tecnologia e fornecedor: a definir após a aprovação das soluções.', 'pendente', ''));
    }
    const arqSec = {
      id: 'arquitetura', titulo: 'Arquitetura sugerida', nota: 'Arquitetura de referência, independente de produto e de tecnologia.',
      grupos: depsComSolucao.length ? [G('Componentes', arqItens), dia('Arquitetura técnica', D.arquitetura({ usuarios: rUsu && rUsu.classe === 'informativa' ? rUsu.texto : '', mobile, multiempresa: !!A.multiempresa, integracoes: integracoes.map((x) => x.split(':')[0]), importacao: temPad('planilha') }), true)]
        : [G('', [it('Arquitetura não sugerida: ainda não há solução proposta.', 'pendente', '')])]
    };

    /* ================= 9. Etapas de desenvolvimento ================= */
    const etapas = [];
    etapas.push('Validar este relatório com o cliente e resolver ' + plural(totalPend, 'pendência', 'pendências') + (A.divergencia ? ', incluindo a divergência de volumes' : '') + '.');
    if (depsComSolucao.length) {
      etapas.push('Aprovar, rejeitar ou ajustar a solução de cada departamento: ' + depsComSolucao.map((d) => d.nome).join(', ') + '.');
      etapas.push('Escolher a forma de entrega' + (A.semSistema ? ' (sistema de mercado configurado ou desenvolvimento novo, já que não há sistema em uso)' : '') + '.');
      const ents = unicos(depsComSolucao.flatMap((d) => Object.values(d.padroes).flatMap((p) => p.def.entidades.map((e) => e[0]))));
      etapas.push('Modelar os dados e criar os cadastros base' + (A.multiempresa ? ' (empresas' + (ents.length ? ', ' : '') : (ents.length ? ' (' : '')) + ents.join(', ') + (A.multiempresa || ents.length ? ')' : '') + '.');
      if (A.multiempresa) etapas.push('Estrutura multiempresa: cadastro das ' + A.multiempresa.n + ' empresas, separação dos dados, visão da administradora e perfis de acesso por empresa. Vem antes dos módulos dos departamentos.');
      depsComSolucao.forEach((d) => {
        const fs = unicos(Object.values(d.padroes).flatMap((p) => p.def.funcionalidades.filter((f) => f[1] !== 'integracao').map((f) => f[0])));
        etapas.push(d.nome + ': ' + fs.join('; ') + '.');
      });
      if (integracoes.length) etapas.push('Integrações: ' + integracoes.join('; ') + '.');
      if (temPad('planilha') || (A.resposta('sis_dados') && A.resposta('sis_dados').classe === 'informativa')) etapas.push('Migrar os dados atuais (planilhas e históricos) para a nova base.');
      etapas.push('Testar com o cliente usando os critérios de aceitação de cada solução.');
      etapas.push('Treinar os usuários, implantar por fases e acompanhar o uso.');
    }
    const etapasSec = { id: 'etapas', titulo: 'Etapas de desenvolvimento', nota: 'Sequência lógica sugerida. Os departamentos seguem a prioridade informada pelo cliente.', grupos: [G('', etapas.map((e) => it(e, 'recomendacao', 'Sugestão do sistema')), { prefixo: 'Etapa ' })] };

    /* ================= 10. Riscos, dependências e pendências ================= */
    const riscos = unicos(depsComSolucao.flatMap((d) => Object.values(d.padroes).flatMap((p) => p.def.riscos))).map((x) => it(x, 'inferencia', 'Análise das respostas'));
    if (prazoRisco) riscos.push(it('Prazo informado (' + A.resposta('sol_prazo').texto + ') é curto para o escopo identificado.', 'inferencia', A.resposta('sol_prazo').fonte));
    if (A.aprovador) riscos.push(it('Decisões concentradas no papel de ' + A.aprovador.papel + ': aprovações podem virar gargalo se não houver substituto definido.', 'inferencia', A.aprovador.fonte));
    const dependencias = [];
    if (integracoes.length) dependencias.push(it('Contrato e documentação técnica do banco para a integração.', 'inferencia', 'Análise das respostas'));
    if (temPad('pagamentos') || temPad('contratacao')) dependencias.push(it('Coleta dos dados cadastrais dos colaboradores e beneficiários.', 'inferencia', 'Análise das respostas'));
    dependencias.push(it('Disponibilidade dos responsáveis de cada área para validar processos e testar.', 'inferencia', 'Sugestão do sistema'));
    const pend = [];
    A.pendencias.divergencias.forEach((p) => pend.push(it(p.texto, 'pendente', p.fonte)));
    A.pendencias.vagas.forEach((r) => pend.push(it(curto(r.id) + ': “' + r.texto + '” — resposta vaga, detalhar.', 'pendente', r.etapa)));
    A.pendencias.desconhecidas.forEach((r) => pend.push(it(curto(r.id) + ': “' + r.texto + '” — cliente não soube responder.', 'pendente', r.etapa)));
    const porEtapa = (lista) => { const m = {}; lista.forEach((r) => { (m[r.etapa] = m[r.etapa] || []).push(r); }); return m; };
    Object.entries(porEtapa(A.pendencias.semResposta)).forEach(([et, rs]) => pend.push(it(et + ' — sem resposta: ' + rs.map((r) => curto(r.id)).join('; ') + '.', 'pendente', et)));
    Object.entries(porEtapa(A.pendencias.marcadas)).forEach(([et, rs]) => pend.push(it(et + ' — ' + plural(rs.length, 'resposta marcada', 'respostas marcadas') + ' para confirmar: ' + rs.map((r) => curto(r.id)).join('; ') + '.', 'pendente', et)));
    const riscoSec = {
      id: 'riscos', titulo: 'Riscos, dependências e pendências', nota: '',
      grupos: [G('Riscos', riscos), G('Dependências', dependencias), G('Pendências do levantamento', pend.length ? pend : [it('Nenhuma pendência.', 'cliente', '')])].filter((g) => g.itens.length)
    };

    /* ================= 11. Estimativa preliminar ================= */
    const faltas = [];
    if (!depsComSolucao.length) faltas.push('soluções propostas');
    if (depsComSolucao.some((d) => !d.processos.some((p) => p.etapas.length))) faltas.push('passo a passo dos processos de ' + depsComSolucao.filter((d) => !d.processos.some((p) => p.etapas.length)).map((d) => d.nome).join(', '));
    if (A.divergencia) faltas.push('volume real de pagamentos');
    if (A.reqGeral.some((r) => r.vaga)) faltas.push('detalhamento dos requisitos vagos');
    if (A.pendencias.vagas.length + A.pendencias.desconhecidas.length > 3) faltas.push('respostas vagas ou desconhecidas (' + (A.pendencias.vagas.length + A.pendencias.desconhecidas.length) + ')');
    let estItens;
    if (faltas.length) {
      estItens = [it('Estimativa não apresentada: dados insuficientes. Faltam: ' + faltas.join('; ') + '.', 'pendente', 'Análise das respostas')];
    } else {
      estItens = depsComSolucao.map((d) => {
        const fs = unicos(Object.values(d.padroes).flatMap((p) => p.def.funcionalidades));
        const pts = fs.reduce((s, f) => s + (f[1] === 'integracao' ? 3 : f[1] === 'especifica' ? 2 : 1), 0);
        const nivel = pts <= 6 ? 'baixa' : pts <= 12 ? 'média' : 'alta';
        return it(d.nome + ': complexidade relativa ' + nivel + ' (' + plural(fs.length, 'funcionalidade', 'funcionalidades') + ', ' + plural(fs.filter((f) => f[1] === 'integracao').length, 'integração', 'integrações') + '). Prazo e custo dependem da forma de entrega escolhida.', 'recomendacao', 'Análise das respostas');
      });
    }
    const estSec = { id: 'estimativa', titulo: 'Estimativa preliminar', nota: 'Apresentada somente quando há dados suficientes. Indica complexidade relativa, não prazo nem preço.', grupos: [G('', estItens)] };

    /* ================= 12. Próximos passos e aprovação ================= */
    const prox = [it('Revisar este relatório com ' + (c.responsaveis.find((p) => t(p.nome)) ? t(c.responsaveis.find((p) => t(p.nome)).nome) : 'o responsável da empresa') + ' e registrar a decisão sobre cada solução.', 'recomendacao', 'Sugestão do sistema')];
    if (totalPend) prox.push(it('Agendar retorno para resolver as pendências listadas na seção 10.', 'recomendacao', 'Sugestão do sistema'));
    prox.push(it('Com as soluções aprovadas, detalhar requisitos, prazo e investimento da primeira fase.', 'recomendacao', 'Sugestão do sistema'));
    const aprovSec = {
      id: 'aprovacao', titulo: 'Próximos passos e aprovação do cliente', nota: '',
      grupos: [G('Situação das soluções', [], { tipo: 'aprovacoes', chaves: (A.multiempresa ? ['multiempresa'] : []).concat(depsComSolucao.map((d) => d.chave), transv.length ? ['entre_departamentos'] : []), nomes: (A.multiempresa ? ['Estrutura multiempresa'] : []).concat(depsComSolucao.map((d) => d.nome), transv.length ? ['Entre departamentos'] : []) }), G('Próximos passos', prox), G('Aceite', [], { tipo: 'assinatura' })]
    };

    /* ================= Anexo técnico: respostas originais ================= */
    const anexo = { id: 'anexo', titulo: 'Anexo técnico — respostas originais', anexo: true, nota: 'Respostas como registradas na entrevista.', grupos: [] };
    R.ETAPAS.filter((e) => e.perguntas).forEach((e) => {
      const itens = A.respostas.filter((r) => r.etapaId === e.id && r.classe !== 'vazia').map((r) => it(r.pergunta + '\n' + r.texto, r.pendente ? 'pendente' : 'cliente', ''));
      if (e.lista) {
        E[e.lista].filter((x) => t(x.nome)).forEach((x) => {
          const campos = (e.lista === 'departamentos' ? R.CAMPOS_DEPARTAMENTO : R.CAMPOS_PROCESSO).filter((f) => t(x[f.campo]));
          itens.unshift(it(t(x.nome) + '\n' + campos.map((f) => f.rotulo + ': ' + t(x[f.campo])).join('\n'), 'cliente', ''));
        });
      }
      if (itens.length) anexo.grupos.push(G(e.titulo, itens));
    });
    if ((E.anexos || []).length) anexo.grupos.push(G('Fotos e documentos', [], { tipo: 'anexos' }));

    return {
      versao: 2,
      geradoEm: new Date().toISOString(),
      secoes: [resumoSec, geralSec, depSec, procSec, solSec, diaSec, reqSec, arqSec, etapasSec, riscoSec, estSec, aprovSec, anexo]
    };
  }

  R.relatorio = { gerar };
})();
