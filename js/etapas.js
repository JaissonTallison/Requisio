/* Requisio — etapas do levantamento e perguntas */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  R.ETAPAS = [
    {
      id: 'cadastro', tipo: 'cadastro', titulo: 'Cadastro',
      desc: 'Identificação da empresa, responsáveis e entrevistados.'
    },
    {
      id: 'emp', titulo: 'Empresa',
      desc: 'Atividade, mercado, porte da operação e objetivos.',
      perguntas: [
        { id: 'emp_atividade', q: 'O que a empresa faz? Quais produtos ou serviços oferece?' },
        { id: 'emp_historia', q: 'Há quanto tempo atua e como evoluiu até hoje?' },
        { id: 'emp_clientes', q: 'Quem são os principais clientes e como chegam até a empresa?' },
        { id: 'emp_unidades', q: 'Quantas unidades, filiais ou pontos de operação existem? Onde ficam?' },
        { id: 'emp_volume', q: 'Qual o volume aproximado da operação?', ajuda: 'Pedidos, atendimentos, notas, ordens ou contratos por mês.' },
        { id: 'emp_objetivos', q: 'Quais são os objetivos da empresa para os próximos 12 a 24 meses?' },
        { id: 'emp_motivacao', q: 'O que motivou a busca por uma solução neste momento?' }
      ]
    },
    {
      id: 'org', titulo: 'Estrutura organizacional',
      desc: 'Hierarquia, decisões e comunicação entre áreas.',
      perguntas: [
        { id: 'org_organograma', q: 'Como a empresa está organizada? Descreva a hierarquia e as áreas.' },
        { id: 'org_colaboradores', q: 'Quantos colaboradores há no total e em cada área?' },
        { id: 'org_decisao', q: 'Quem toma as decisões e como elas são aprovadas?', ajuda: 'Alçadas, aprovações financeiras, quem assina.' },
        { id: 'org_terceiros', q: 'Há atividades terceirizadas? Quais e com quem?' },
        { id: 'org_comunicacao', q: 'Como as áreas se comunicam e trocam informações no dia a dia?' }
      ]
    },
    {
      id: 'dep', titulo: 'Departamentos', lista: 'departamentos',
      desc: 'Cadastre cada área visitada com suas atividades e dificuldades.',
      perguntas: [
        { id: 'dep_integracao', q: 'Quais áreas dependem mais umas das outras? Onde a passagem de informação atrasa?' }
      ]
    },
    {
      id: 'pro', titulo: 'Processos', lista: 'processos',
      desc: 'Mapeie como cada processo funciona hoje (AS-IS).',
      perguntas: [
        { id: 'pro_criticos', q: 'Quais processos são mais críticos para o negócio?' },
        { id: 'pro_indicadores', q: 'Quais indicadores ou controles são acompanhados hoje? Como são calculados?' }
      ]
    },
    {
      id: 'prb', titulo: 'Problemas',
      desc: 'Problemas, gargalos, erros e retrabalho relatados.',
      perguntas: [
        { id: 'prb_principais', q: 'Quais são os principais problemas enfrentados hoje?' },
        { id: 'prb_gargalos', q: 'Onde estão os gargalos?', ajuda: 'Etapas que atrasam, acumulam trabalho ou dependem de uma única pessoa.' },
        { id: 'prb_retrabalho', q: 'Há retrabalho, digitação repetida ou controles paralelos?', ajuda: 'Planilhas, papel, mensagens, lançamentos em mais de um lugar.' },
        { id: 'prb_erros', q: 'Quais erros acontecem com frequência e qual o impacto?', ajuda: 'Financeiro, cliente, prazo, multa.' },
        { id: 'prb_informacao', q: 'Que informações faltam ou demoram para a tomada de decisão?' },
        { id: 'prb_tentativas', q: 'O que já foi tentado para resolver esses problemas? Qual foi o resultado?' }
      ]
    },
    {
      id: 'sis', titulo: 'Sistemas atuais',
      desc: 'Sistemas, planilhas, infraestrutura e dados existentes.',
      perguntas: [
        { id: 'sis_lista', q: 'Quais sistemas e ferramentas são usados hoje?', ajuda: 'Um por linha: nome, finalidade e área que usa.' },
        { id: 'sis_satisfacao', q: 'O que funciona bem e o que não funciona nos sistemas atuais?' },
        { id: 'sis_planilhas', q: 'Quais controles são feitos em planilhas, papel ou aplicativos de mensagem?' },
        { id: 'sis_integracoes', q: 'Os sistemas trocam dados entre si? Quais informações precisariam ser integradas?' },
        { id: 'sis_infra', q: 'Como é a infraestrutura?', ajuda: 'Computadores, internet, servidores, nuvem, celulares.' },
        { id: 'sis_contratos', q: 'Há contratos, licenças ou fornecedores de sistema com prazo ou restrição?' },
        { id: 'sis_dados', q: 'Quais dados históricos precisam ser aproveitados em uma nova solução?' }
      ]
    },
    {
      id: 'req', titulo: 'Requisitos',
      desc: 'O que a solução precisa fazer e como precisa funcionar.',
      perguntas: [
        { id: 'req_funcionais', q: 'O que a solução precisa fazer?', ajuda: 'Uma necessidade por linha.' },
        { id: 'req_relatorios', q: 'Quais relatórios, documentos ou indicadores a solução deve emitir?' },
        { id: 'req_regras', q: 'Quais regras de negócio devem ser respeitadas?', ajuda: 'Cálculos, políticas, alçadas, prazos e restrições. Uma por linha.' },
        { id: 'req_usuarios', q: 'Quem vai usar a solução? Quantos usuários e com quais perfis de acesso?' },
        { id: 'req_acesso', q: 'Onde e como será usada?', ajuda: 'Escritório, campo, celular, locais sem internet.' },
        { id: 'req_seguranca', q: 'Há exigências de segurança, privacidade (LGPD), auditoria ou legislação específica?' },
        { id: 'req_desempenho', q: 'Há expectativas de disponibilidade, desempenho ou volume de dados?' }
      ]
    },
    {
      id: 'sol', titulo: 'Solução desejada',
      desc: 'Expectativas, prioridades, prazo e restrições do cliente.',
      perguntas: [
        { id: 'sol_ideal', q: 'Como o cliente imagina o funcionamento ideal dos processos?' },
        { id: 'sol_expectativa', q: 'O que o cliente espera de uma nova solução? Como vai medir o sucesso?' },
        { id: 'sol_preferencia', q: 'Há preferência por algum tipo de solução? Por quê?', ajuda: 'Sistema próprio, sistema de mercado, aplicativo, automação, integração ou nenhuma.' },
        { id: 'sol_prioridades', q: 'O que é mais urgente resolver?', ajuda: 'Uma prioridade por linha, da mais para a menos urgente.' },
        { id: 'sol_prazo', q: 'Existe prazo desejado ou data limite para a implantação?' },
        { id: 'sol_orcamento', q: 'Há orçamento previsto ou faixa de investimento?' },
        { id: 'sol_restricoes', q: 'Há restrições ou receios?', ajuda: 'Mudança de rotina, treinamento, dependência de fornecedor.' }
      ]
    },
    {
      id: 'diagnostico', tipo: 'diagnostico', titulo: 'Diagnóstico',
      desc: 'Respostas organizadas em diagnóstico empresarial, editável e imprimível.'
    }
  ];

  R.CAMPOS_DEPARTAMENTO = [
    { campo: 'responsavel', rotulo: 'Responsável', linha: true },
    { campo: 'pessoas', rotulo: 'Número de pessoas', linha: true },
    { campo: 'atividades', rotulo: 'Principais atividades' },
    { campo: 'entradas', rotulo: 'Informações que recebe e que entrega a outras áreas' },
    { campo: 'ferramentas', rotulo: 'Ferramentas e sistemas usados' },
    { campo: 'dificuldades', rotulo: 'Dificuldades da área' }
  ];

  R.CAMPOS_PROCESSO = [
    { campo: 'departamento', rotulo: 'Departamento', linha: true, lista: 'dl_departamentos' },
    { campo: 'gatilho', rotulo: 'Como o processo começa' },
    { campo: 'etapas', rotulo: 'Passo a passo atual' },
    { campo: 'executores', rotulo: 'Quem executa e quem aprova' },
    { campo: 'ferramentas', rotulo: 'Sistemas, planilhas e documentos usados' },
    { campo: 'volume', rotulo: 'Frequência e volume' },
    { campo: 'tempo', rotulo: 'Tempo médio de execução' },
    { campo: 'regras', rotulo: 'Regras e exceções' },
    { campo: 'problemas', rotulo: 'Problemas e retrabalho' }
  ];

  /* Índice de perguntas por id, com a etapa de origem. */
  R.PERGUNTAS = {};
  R.ETAPAS.forEach((e) => (e.perguntas || []).forEach((p) => { R.PERGUNTAS[p.id] = { q: p.q, etapa: e }; }));
})();
