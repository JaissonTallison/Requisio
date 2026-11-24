/*
 * Requisio — geração do diagnóstico empresarial.
 * Regras: nada é inventado. Cada item traz a origem:
 *   cliente  = informado pelo cliente (texto da resposta)
 *   sugestao = sugestão do sistema a partir de padrões nas respostas (precisa de validação)
 *   pendente = informação ausente ou marcada para confirmar
 */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  const t = (s) => (typeof s === 'string' ? s.trim() : '');
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  /* Quebra uma resposta em itens: uma linha por item, sem marcadores de lista. */
  function linhas(s) {
    return t(s)
      .split(/\n+/)
      .map((l) => l.replace(/^\s*(?:[-*•·–]|\d{1,2}[.)-])\s+/, '').trim())
      .filter(Boolean);
  }

  /* Minúsculas e sem acento, mantendo o mesmo comprimento do texto original. */
  function norm(s) {
    return s.split('').map((c) => (c.normalize('NFD')[0] || c).toLowerCase()[0] || c).join('');
  }

  /* Trecho da resposta em volta do termo encontrado, limitado à linha onde ele está. */
  function trecho(s, ini, tam) {
    const li = s.lastIndexOf('\n', ini - 1) + 1;
    let lf = s.indexOf('\n', ini + tam);
    if (lf < 0) lf = s.length;
    let a = Math.max(li, ini - 60);
    let b = Math.min(lf, ini + tam + 60);
    if (a > li) { const e = s.indexOf(' ', a); if (e > -1 && e < ini) a = e + 1; }
    if (b < lf) { const e = s.lastIndexOf(' ', b); if (e > ini + tam) b = e; }
    return (a > li ? '…' : '') + s.slice(a, b).replace(/\s+/g, ' ').trim() + (b < lf ? '…' : '');
  }

  const fechar = (s) => (/[.!?…”"]$/.test(s) ? s : s + '.');

  /* Padrões que indicam oportunidade de automação. */
  const PADROES = [
    { id: 'planilha', rotulo: 'Controle em planilha', re: /planilha|excel|google sheets/,
      sugestao: 'avaliar registro centralizado, com validações e histórico, no lugar de planilhas paralelas.',
      tobe: 'registrar as informações uma vez, em local único, sem planilhas paralelas' },
    { id: 'papel', rotulo: 'Registro manual ou em papel', re: /papel|caderno|ficha|impress|manualmente|a mao|anotad|anota /,
      sugestao: 'avaliar formulário eletrônico preenchido no momento da execução.',
      tobe: 'capturar os dados em formulário eletrônico no momento da execução' },
    { id: 'mensagem', rotulo: 'Solicitações por mensagem ou telefone', re: /whatsapp|zap|e-?mail|telefone|ligac|liga para|mensage/,
      sugestao: 'avaliar canal único de solicitação, com responsável, prazo e histórico.',
      tobe: 'receber solicitações por canal único, com responsável, prazo e histórico' },
    { id: 'redigitacao', rotulo: 'Digitação repetida ou retrabalho', re: /redigit|digit\w* (de novo|novamente|duas vezes|outra vez)|lanc\w* (de novo|novamente|duas vezes)|retrabalho|duplicad|copia e cola|copiar e colar/,
      sugestao: 'avaliar integração ou lançamento único da informação.',
      tobe: 'lançar cada informação uma única vez e compartilhá-la entre áreas e sistemas' },
    { id: 'aprovacao', rotulo: 'Aprovações e autorizações', re: /aprova|assinatura|autoriza/,
      sugestao: 'avaliar fluxo de aprovação com alçadas definidas e aviso ao aprovador.',
      tobe: 'aprovar dentro do fluxo, com alçadas definidas e aviso ao aprovador' },
    { id: 'relatorio', rotulo: 'Consolidação de informações', re: /relatorio|consolid|fechamento|indicador/,
      sugestao: 'avaliar relatórios e indicadores gerados a partir dos dados registrados.',
      tobe: 'obter relatórios e indicadores dos dados registrados, sem consolidação manual' },
    { id: 'prazo', rotulo: 'Controle de prazos', re: /atras|esquec|vencimento|vence |venceu|lembr/,
      sugestao: 'avaliar alertas automáticos de prazo aos responsáveis.',
      tobe: 'acompanhar prazos com alertas automáticos aos responsáveis' },
    { id: 'conferencia', rotulo: 'Conferência manual', re: /confer|concilia|checag|bater os|bate os/,
      sugestao: 'avaliar validação e conciliação automáticas.',
      tobe: 'validar os dados na entrada e conciliar sem conferência manual' }
  ];

  const AREAS = [
    ['financeiro', /financeir|contas a (pagar|receber)|tesouraria|fluxo de caixa|cobranca/],
    ['estoque', /estoque|almoxarifado|inventario/],
    ['fiscal', /fiscal|nota fiscal|nf-?e|tribut/],
    ['compras', /compras|suprimento|fornecedor/],
    ['vendas', /vendas|comercial|pedido|orcamento/],
    ['produção', /producao|fabrica|industria|ordem de producao/],
    ['pessoas', /recursos humanos|\brh\b|folha|departamento pessoal|ponto eletronico/],
    ['contabilidade', /contabil/],
    ['logística', /logistica|expedicao|entrega|frota/]
  ];

  function gerar(E) {
    const P = R.PERGUNTAS;
    const c = E.cadastro;
    const resp = (id) => t(E.respostas[id] && E.respostas[id].texto);
    const conf = (id) => !!(E.respostas[id] && E.respostas[id].confirmar);
    const fonteQ = (id) => P[id].etapa.titulo + ' › ' + P[id].q;
    const it = (texto, origem, fonte, extra) => Object.assign({ id: R.uid(), texto, origem, fonte: fonte || '' }, extra || {});
    const deQ = (id, extra) => linhas(resp(id)).map((l) => it(l, conf(id) ? 'pendente' : 'cliente', fonteQ(id), extra));
    const deQs = (ids, extra) => ids.flatMap((id) => deQ(id, extra));
    const grupo = (titulo, itens, opc) => Object.assign({ id: R.uid(), titulo, nota: '', prefixo: '', comStatus: false, itens }, opc || {});
    const ouFalta = (itens, msg) => (itens.length ? itens : [it(msg || 'Não informado durante a entrevista.', 'pendente', '')]);
    const nomeDe = (x, tipo) => t(x.nome) || tipo + ' sem nome';
    const extrasDe = (ids) => ids.flatMap((eid) => (E.extras[eid] || [])
      .filter((x) => t(x.resposta))
      .map((x) => it(t(x.resposta), x.confirmar ? 'pendente' : 'cliente', 'Pergunta complementar › ' + (t(x.pergunta) || 'sem título'))));
    const campoPend = (x, campo) => !!x[campo + '__confirmar'];

    /* ---------- fontes para busca de padrões (situação atual) ---------- */
    const fontes = [];
    const addF = (fonte, texto, tag) => { if (t(texto)) fontes.push({ fonte, texto: t(texto), tag }); };
    ['org_comunicacao', 'dep_integracao', 'pro_criticos', 'pro_indicadores',
      'prb_principais', 'prb_gargalos', 'prb_retrabalho', 'prb_erros', 'prb_informacao', 'prb_tentativas',
      'sis_lista', 'sis_satisfacao', 'sis_planilhas', 'sis_integracoes', 'sis_infra']
      .forEach((id) => addF(fonteQ(id), resp(id), id.slice(0, 3)));
    E.departamentos.forEach((d) => ['atividades', 'entradas', 'ferramentas', 'dificuldades']
      .forEach((k) => addF('Departamentos › ' + nomeDe(d, 'Departamento'), d[k], 'dep')));
    E.processos.forEach((p) => R.CAMPOS_PROCESSO.filter((f) => !f.linha)
      .forEach((f) => addF('Processos › ' + nomeDe(p, 'Processo'), p[f.campo], 'pro:' + p.id)));
    ['org', 'dep', 'pro', 'prb', 'sis'].forEach((eid) => (E.extras[eid] || [])
      .forEach((x) => addF('Pergunta complementar › ' + (t(x.pergunta) || 'sem título'), x.resposta, eid)));

    const desejo = [];
    ['req_funcionais', 'req_relatorios', 'req_regras', 'req_acesso', 'sol_ideal', 'sol_expectativa', 'sol_preferencia']
      .forEach((id) => { if (resp(id)) desejo.push({ fonte: fonteQ(id), texto: resp(id) }); });

    function buscar(re, lista, max) {
      const achou = [];
      for (const f of lista) {
        const m = re.exec(norm(f.texto));
        if (m && !achou.some((a) => a.fonte === f.fonte)) achou.push({ fonte: f.fonte, trecho: trecho(f.texto, m.index, m[0].length) });
        if (achou.length >= (max || 99)) break;
      }
      return achou;
    }

    const achados = {};
    PADROES.forEach((p) => { const a = buscar(p.re, fontes); if (a.length) achados[p.id] = a; });

    /* ---------- 1. Perfil ---------- */
    const ident = [];
    const addC = (rot, v, obrig) => {
      if (t(v)) ident.push(it(rot + ': ' + t(v), 'cliente', 'Cadastro'));
      else if (obrig) ident.push(it(rot + ': não informado.', 'pendente', 'Cadastro'));
    };
    addC('Empresa', c.empresa, true);
    addC('Nome fantasia', c.fantasia);
    addC('CNPJ', c.cnpj);
    addC('Ramo de atuação', c.ramo, true);
    addC('Porte', c.porte, true);
    addC('Localização', c.cidade);
    addC('Site', c.site);
    if (t(c.dataVisita)) addC('Data da visita', new Date(c.dataVisita + 'T12:00:00').toLocaleDateString('pt-BR'));
    addC('Levantamento conduzido por', c.consultor);

    const pessoa = (p, comDep) => [t(p.nome), t(p.cargo), comDep ? t(p.departamento) : '', t(p.contato)].filter(Boolean).join(' — ');
    const pessoas = []
      .concat(c.responsaveis.filter((p) => t(p.nome)).map((p) => it('Responsável: ' + pessoa(p), 'cliente', 'Cadastro')))
      .concat(c.entrevistados.filter((p) => t(p.nome)).map((p) => it('Entrevistado: ' + pessoa(p, true), 'cliente', 'Cadastro')));

    const perfil = {
      id: 'perfil', titulo: 'Perfil da empresa', nota: '',
      grupos: [
        grupo('Identificação', ident),
        grupo('Responsáveis e entrevistados', ouFalta(pessoas, 'Responsáveis e entrevistados não cadastrados.')),
        grupo('Atividade e contexto', ouFalta(deQs(['emp_atividade', 'emp_historia', 'emp_clientes', 'emp_unidades', 'emp_volume', 'emp_objetivos', 'emp_motivacao']).concat(extrasDe(['emp']))))
      ]
    };

    /* ---------- 2. Estrutura organizacional ---------- */
    const deps = E.departamentos.map((d) => {
      const partes = [nomeDe(d, 'Departamento')];
      R.CAMPOS_DEPARTAMENTO.filter((f) => f.campo !== 'dificuldades').forEach((f) => {
        if (t(d[f.campo])) partes.push(f.rotulo + ': ' + t(d[f.campo]));
      });
      const pend = R.CAMPOS_DEPARTAMENTO.some((f) => campoPend(d, f.campo));
      return it(partes.join('\n'), pend ? 'pendente' : 'cliente', 'Departamentos');
    });
    const estrutura = {
      id: 'estrutura', titulo: 'Estrutura organizacional', nota: '',
      grupos: [
        grupo('Organização', ouFalta(deQs(['org_organograma', 'org_colaboradores', 'org_decisao', 'org_terceiros', 'org_comunicacao']).concat(extrasDe(['org'])))),
        grupo('Departamentos', ouFalta(deps.concat(deQ('dep_integracao')).concat(extrasDe(['dep'])), 'Nenhum departamento cadastrado.'))
      ]
    };

    /* ---------- 3. Processos atuais (AS-IS) ---------- */
    const gruposProc = E.processos.map((p) => {
      const nome = nomeDe(p, 'Processo');
      const itens = [];
      R.CAMPOS_PROCESSO.forEach((f) => {
        if (t(p[f.campo])) itens.push(it(f.rotulo + ': ' + t(p[f.campo]), campoPend(p, f.campo) ? 'pendente' : 'cliente', 'Processos › ' + nome));
      });
      if (!t(p.etapas)) itens.push(it('Passo a passo atual não informado.', 'pendente', 'Processos › ' + nome));
      return grupo('Processo: ' + nome, itens);
    });
    const asis = {
      id: 'asis', titulo: 'Processos atuais (AS-IS)', nota: '',
      grupos: (gruposProc.length ? gruposProc : [grupo('Processos mapeados', [it('Nenhum processo mapeado na entrevista.', 'pendente', '')])])
        .concat([
          grupo('Processos críticos e controles', ouFalta(deQs(['pro_criticos', 'pro_indicadores']))),
          grupo('Sistemas e ferramentas atuais', ouFalta(deQs(['sis_lista', 'sis_satisfacao', 'sis_planilhas', 'sis_infra', 'sis_contratos']))),
          grupo('Informações complementares', extrasDe(['pro', 'sis']))
        ]).filter((g) => g.itens.length)
    };

    /* ---------- 4. Problemas e gargalos ---------- */
    const porArea = []
      .concat(E.departamentos.filter((d) => t(d.dificuldades)).map((d) => it(nomeDe(d, 'Departamento') + ': ' + t(d.dificuldades), campoPend(d, 'dificuldades') ? 'pendente' : 'cliente', 'Departamentos')))
      .concat(E.processos.filter((p) => t(p.problemas)).map((p) => it(nomeDe(p, 'Processo') + ': ' + t(p.problemas), campoPend(p, 'problemas') ? 'pendente' : 'cliente', 'Processos')));
    const problemas = {
      id: 'problemas', titulo: 'Problemas e gargalos', nota: '',
      grupos: [
        grupo('Problemas relatados', ouFalta(deQs(['prb_principais', 'prb_erros', 'prb_informacao', 'prb_tentativas']).concat(extrasDe(['prb'])))),
        grupo('Gargalos e retrabalho', ouFalta(deQs(['prb_gargalos', 'prb_retrabalho']))),
        grupo('Por departamento e processo', porArea)
      ].filter((g) => g.itens.length)
    };

    /* ---------- 5. Oportunidades de automação ---------- */
    const oport = PADROES.filter((p) => achados[p.id]).map((p) => it(
      p.rotulo + ': ' + p.sugestao + '\nOcorrências:\n' + achados[p.id].map((a) => '• ' + a.fonte + ': “' + a.trecho + '”').join('\n'),
      'sugestao', 'Análise das respostas'));
    const oportunidades = {
      id: 'oportunidades', titulo: 'Oportunidades de automação',
      nota: 'Sugestões do sistema a partir de termos encontrados nas respostas. Não são requisitos aprovados: só entram no escopo após validação com o cliente.',
      grupos: [grupo('Oportunidades identificadas', oport)]
    };

    /* ---------- 6. Requisitos ---------- */
    const st = { status: 'a_validar' };
    const rf = deQs(['req_funcionais', 'req_relatorios'], st);
    const rnf = deQs(['req_usuarios', 'req_acesso', 'req_seguranca', 'req_desempenho'], st);
    const requisitos = {
      id: 'requisitos', titulo: 'Requisitos funcionais e não funcionais',
      nota: 'Requisitos informados pelo cliente ficam “A validar” até a confirmação formal. Oportunidades sugeridas não entram nesta lista sem validação.',
      grupos: [
        grupo('Requisitos funcionais', ouFalta(rf), { prefixo: 'RF', comStatus: true }),
        grupo('Requisitos não funcionais', ouFalta(rnf), { prefixo: 'RNF', comStatus: true }),
        grupo('Informações complementares', extrasDe(['req']))
      ].filter((g) => g.itens.length)
    };
    requisitos.grupos.forEach((g) => { if (g.comStatus) g.itens.forEach((i) => { i.status = 'a_validar'; }); });

    /* ---------- 7. Regras de negócio ---------- */
    const rn = deQ('req_regras', st).concat(E.processos.filter((p) => t(p.regras)).flatMap((p) => linhas(p.regras)
      .map((l) => it(nomeDe(p, 'Processo') + ': ' + l, campoPend(p, 'regras') ? 'pendente' : 'cliente', 'Processos › ' + nomeDe(p, 'Processo'), st))));
    const regras = {
      id: 'regras', titulo: 'Regras de negócio', nota: '',
      grupos: [grupo('Regras de negócio', ouFalta(rn).map((i) => Object.assign(i, { status: 'a_validar' })), { prefixo: 'RN', comStatus: true })]
    };

    /* ---------- 8. Integrações ---------- */
    const intSug = [];
    if (achados.redigitacao) {
      intSug.push(it('Avaliar integração entre os sistemas e áreas onde há digitação repetida: ' + fechar(achados.redigitacao.map((a) => a.fonte).join('; ')), 'sugestao', 'Análise das respostas'));
    }
    if (linhas(resp('sis_lista')).length >= 2 && !resp('sis_integracoes')) {
      intSug.push(it('Confirmar se os sistemas listados precisam trocar dados entre si.', 'pendente', fonteQ('sis_lista')));
    }
    const integracoes = {
      id: 'integracoes', titulo: 'Integrações necessárias', nota: '',
      grupos: [
        grupo('Integrações informadas', ouFalta(deQ('sis_integracoes'))),
        grupo('Dados a aproveitar (migração)', ouFalta(deQ('sis_dados'))),
        grupo('Integrações a avaliar', intSug)
      ].filter((g) => g.itens.length)
    };

    /* ---------- 9. Processos futuros (TO-BE) ---------- */
    const tobeSug = E.processos.map((p) => {
      const pads = PADROES.filter((pd) => fontes.some((f) => f.tag === 'pro:' + p.id && pd.re.test(norm(f.texto))));
      if (!pads.length) return null;
      return it(nomeDe(p, 'Processo') + ': ' + pads.map((pd) => pd.tobe).join('; ') + '.', 'sugestao', 'Processos › ' + nomeDe(p, 'Processo'));
    }).filter(Boolean);
    const tobe = {
      id: 'tobe', titulo: 'Processos futuros sugeridos (TO-BE)',
      nota: 'Fluxos sugeridos a partir dos problemas mapeados. Devem ser desenhados e validados com o cliente.',
      grupos: [
        grupo('Visão do cliente', ouFalta(deQs(['sol_ideal', 'sol_expectativa']))),
        grupo('Sugestões por processo', tobeSug)
      ].filter((g) => g.itens.length)
    };

    /* ---------- 10. Proposta preliminar ---------- */
    const abord = [];
    const addAb = (titulo, desc, evid) => {
      if (!evid.length) return;
      abord.push(it(titulo + ': ' + desc + '\nIndícios: ' + fechar(evid.slice(0, 3).map((e) => (e.trecho ? e.fonte + ' (“' + e.trecho + '”)' : e.fonte)).join('; ')), 'sugestao', 'Análise das respostas'));
    };
    addAb('Revisão de processo, sem novo sistema', 'organizar responsabilidades, padronizar procedimentos e treinar a equipe antes de automatizar',
      buscar(/comunicac|responsabilidade|padroniz|sem padrao|falta de padrao|treinament|cada um faz|depende de uma (unica )?pessoa|desorganiz|procedimento/, fontes, 3));
    addAb('Automação de processos', 'automatizar tarefas repetitivas, controles paralelos, aprovações e alertas',
      ['planilha', 'papel', 'mensagem', 'aprovacao', 'prazo', 'conferencia', 'relatorio'].filter((k) => achados[k])
        .map((k) => ({ fonte: PADROES.find((p) => p.id === k).rotulo + ' em ' + achados[k][0].fonte })));
    addAb('Integração entre plataformas', 'conectar os sistemas existentes para evitar lançamentos repetidos',
      (resp('sis_integracoes') ? [{ fonte: fonteQ('sis_integracoes'), trecho: trecho(resp('sis_integracoes'), 0, 0) }] : [])
        .concat(achados.redigitacao ? [{ fonte: 'Digitação repetida em ' + achados.redigitacao[0].fonte }] : []));
    addAb('Modernização de sistema existente', 'substituir ou atualizar sistemas que não atendem mais',
      buscar(/antig|legado|desatualizad|ultrapassad|lento|trava|sem suporte|descontinuad|nao atende/, fontes.filter((f) => f.tag === 'sis'), 3));
    addAb('Sistema web ou aplicativo mobile', 'permitir uso fora do escritório e por celular',
      buscar(/celular|em campo|externo|mobile|aplicativo|\bapp\b|tablet|remot|fora da empresa|sem internet|offline/, desejo.concat(fontes), 3));
    const textoAreas = norm([E.departamentos.map((d) => t(d.nome) + ' ' + t(d.atividades)).join(' '),
      E.processos.map((p) => t(p.nome)).join(' '), resp('req_funcionais')].join(' '));
    const areas = AREAS.filter(([, re]) => re.test(textoAreas)).map(([n]) => n);
    addAb('ERP ou módulos de gestão', 'integrar as rotinas de gestão em uma base única',
      areas.length >= 3 ? [{ fonte: 'Áreas de gestão citadas: ' + areas.join(', ') }] : []);
    const evPers = buscar(/especific|particular|personaliz|sob medida|nenhum sistema|nao encontr|diferencial|exclusiv/, desejo.concat(fontes.filter((f) => f.tag === 'sis')), 3);
    if (rn.length >= 3) evPers.push({ fonte: plural(rn.length, 'regra de negócio específica informada', 'regras de negócio específicas informadas') });
    addAb('Desenvolvimento de software personalizado', 'construir solução sob medida para regras e fluxos próprios', evPers);

    const proposta = {
      id: 'proposta', titulo: 'Proposta preliminar de solução',
      nota: 'Proposta preliminar e independente de produto. Nem toda necessidade exige um sistema: o tipo de solução deve ser definido após validar os requisitos e as pendências.',
      grupos: [
        grupo('Expectativa e preferência do cliente', ouFalta(deQs(['sol_preferencia', 'sol_restricoes']).concat(extrasDe(['sol'])))),
        grupo('Abordagens a avaliar', ouFalta(abord, 'Dados insuficientes para sugerir uma abordagem. Completar o levantamento.'))
      ]
    };

    /* ---------- 12. Pendências (calculadas antes do plano) ---------- */
    const semResp = [];
    const aConf = [];
    R.ETAPAS.filter((e) => e.perguntas).forEach((e) => e.perguntas.forEach((p) => {
      if (!resp(p.id)) semResp.push(it(p.q, 'pendente', e.titulo));
      else if (conf(p.id)) aConf.push(it(p.q + ' Resposta registrada: “' + trecho(resp(p.id), 0, 0) + '”', 'pendente', e.titulo));
    }));
    Object.keys(E.extras).forEach((eid) => (E.extras[eid] || []).forEach((x) => {
      if (!t(x.pergunta)) return;
      if (!t(x.resposta)) semResp.push(it(t(x.pergunta), 'pendente', 'Pergunta complementar'));
      else if (x.confirmar) aConf.push(it(t(x.pergunta) + ' Resposta registrada: “' + trecho(t(x.resposta), 0, 0) + '”', 'pendente', 'Pergunta complementar'));
    }));
    [['departamentos', R.CAMPOS_DEPARTAMENTO, 'Departamento'], ['processos', R.CAMPOS_PROCESSO, 'Processo']].forEach(([chave, campos, tipo]) => {
      E[chave].forEach((x) => campos.forEach((f) => {
        if (campoPend(x, f.campo)) aConf.push(it(tipo + ' ' + nomeDe(x, tipo) + ' — ' + f.rotulo + ': “' + trecho(t(x[f.campo]), 0, 0) + '”', 'pendente', tipo + 's'));
      }));
    });
    const cadPend = [];
    if (!t(c.empresa)) cadPend.push(it('Nome da empresa', 'pendente', 'Cadastro'));
    if (!t(c.ramo)) cadPend.push(it('Ramo de atuação', 'pendente', 'Cadastro'));
    if (!t(c.porte)) cadPend.push(it('Porte', 'pendente', 'Cadastro'));
    if (!c.responsaveis.some((p) => t(p.nome))) cadPend.push(it('Responsáveis na empresa', 'pendente', 'Cadastro'));
    if (!c.entrevistados.some((p) => t(p.nome))) cadPend.push(it('Entrevistados', 'pendente', 'Cadastro'));
    E.processos.filter((p) => !t(p.etapas)).forEach((p) => semResp.push(it('Passo a passo do processo ' + nomeDe(p, 'Processo') + '.', 'pendente', 'Processos')));
    const nPend = semResp.length + aConf.length + cadPend.length;

    /* ---------- 11. Prioridades e plano ---------- */
    const prior = deQ('sol_prioridades');
    const plano = [];
    if (nPend) plano.push('Validar este diagnóstico com o cliente e resolver ' + plural(nPend, 'pendência de confirmação', 'pendências de confirmação') + '.');
    else plano.push('Validar este diagnóstico com o cliente.');
    const nRF = rf.length, nRNF = rnf.length, nRN = rn.length;
    plano.push('Revisar e aprovar formalmente os requisitos (' + plural(nRF, 'funcional', 'funcionais') + ', ' + plural(nRNF, 'não funcional', 'não funcionais') + ') e ' + plural(nRN, 'regra de negócio', 'regras de negócio') + '.');
    if (oport.length) plano.push('Avaliar as oportunidades de automação com o cliente e incluir no escopo apenas as aprovadas.');
    plano.push('Definir o tipo de solução a partir dos requisitos aprovados' + (resp('sol_prazo') || resp('sol_orcamento') ? ', considerando o prazo e o orçamento informados.' : '.'));
    if (prior.length) {
      plano.push('Primeira fase: tratar a prioridade principal informada pelo cliente — “' + prior[0].texto + '”.');
      if (prior.length > 1) plano.push('Fases seguintes: demais prioridades, na ordem informada pelo cliente.');
    } else {
      plano.push('Definir com o cliente a prioridade principal, não informada na entrevista.');
    }
    if (resp('sis_dados')) plano.push('Planejar a migração dos dados históricos informados.');
    plano.push('Planejar o treinamento dos usuários e o acompanhamento após a implantação.');

    const prioridades = {
      id: 'prioridades', titulo: 'Prioridades e plano sugerido de implantação', nota: '',
      grupos: [
        grupo('Prioridades informadas pelo cliente', ouFalta(prior)),
        grupo('Prazo e investimento', ouFalta(deQs(['sol_prazo', 'sol_orcamento']))),
        grupo('Plano sugerido', plano.map((p) => it(p, 'sugestao', 'Sugestão do sistema')), { prefixo: 'Etapa ' })
      ]
    };

    const pendencias = {
      id: 'pendencias', titulo: 'Pendências de confirmação',
      nota: 'Informações ausentes ou marcadas para confirmar durante a entrevista.',
      grupos: [
        grupo('Cadastro incompleto', cadPend),
        grupo('Respostas a confirmar com o cliente', aConf),
        grupo('Perguntas sem resposta', semResp)
      ].filter((g) => g.itens.length)
    };
    if (!pendencias.grupos.length) pendencias.grupos.push(grupo('Pendências', []));

    return {
      geradoEm: new Date().toISOString(),
      secoes: [perfil, estrutura, asis, problemas, oportunidades, requisitos, regras, integracoes, tobe, proposta, prioridades, pendencias]
    };
  }

  R.diagnostico = { gerar };
})();
