/*
 * Requisio — motor de análise.
 * Lê as respostas e monta um modelo estruturado: respostas classificadas, departamentos,
 * fatos atribuídos, problemas com causa e impacto, padrões de solução, requisitos e pendências.
 *
 * Regras de origem:
 *   cliente      = texto informado pelo cliente (sem acréscimos)
 *   pendente     = resposta ausente, vaga, desconhecida ou marcada para confirmar
 *   inferencia   = conclusão do sistema a partir das respostas (mostra a evidência)
 *   recomendacao = proposta técnica do sistema (precisa de validação)
 * Nada é tratado como aprovado: aprovação é sempre manual.
 */
(function () {
  'use strict';
  const R = (window.Requisio = window.Requisio || {});

  const t = (s) => (typeof s === 'string' ? s.trim() : '');
  /* Minúsculas e sem acento, com o mesmo comprimento do original. */
  function norm(s) {
    return String(s || '').split('').map((c) => (c.normalize('NFD')[0] || c).toLowerCase()[0] || c).join('');
  }
  const slug = (s) => norm(t(s)).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'geral';
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Divide uma resposta em frases ou linhas, sem marcadores de lista. */
  function frases(s) {
    return t(s).replace(/([.!?;])\s+/g, '$1\n').split(/\n+/)
      .map((x) => x.replace(/^\s*(?:[-*•·–]|\d{1,2}[.)-])\s+/, '').trim()).filter(Boolean);
  }

  /* ---------- Classificação das respostas ---------- */
  const NEG = /^(nao|nenhum|nenhuma|nada|sem|nunca|inexistente)\b/;
  const DESC = /^(nao sei|nao lembro|nao tenho certeza|talvez|a definir|depende|sei la|desconhec)/;
  const VAGO = /^(sim|bastante|varios|varias|muitos|muitas|todos|todas|alguns|algumas|normal|ok)\b/;

  function classificar(texto, descritiva) {
    const n = norm(t(texto)).replace(/[.!,;]+$/, '').trim();
    if (!n) return 'vazia';
    if (DESC.test(n)) return 'desconhecida';
    const palavras = n.split(/\s+/).filter(Boolean);
    if (NEG.test(n) && palavras.length <= 4 && !/\d/.test(n) && !/apenas|somente|\bso\b|exceto|\bmas\b/.test(n)) return 'negativa';
    if (/\d/.test(n)) return 'informativa';
    if (VAGO.test(n) && palavras.length <= 3) return 'vaga';
    if (descritiva && palavras.length < 4) return 'vaga';
    return 'informativa';
  }

  /* Termo negado no texto? ("não usamos planilha"), mas "nenhum, apenas o Excel" não é negação. */
  function negado(n, idx) {
    const antes = n.slice(Math.max(0, idx - 30), idx);
    const m = /\b(nao|nem|sem|nenhum|nenhuma)\b([^.,;!?]*)$/.exec(antes);
    if (!m) return false;
    return !/apenas|somente|\bso\b|exceto|alem/.test(m[2]);
  }

  function achar(re, n) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(n))) { if (!negado(n, m.index)) return m; if (!m[0].length) g.lastIndex++; }
    return null;
  }

  /* ---------- Catálogo de departamentos (nome explícito e tema) ---------- */
  const CATALOGO = [
    { nome: 'Financeiro', nomeRe: /financeir|financas|tesouraria|contas a (pagar|receber)/, temaRe: /pagament|\bpix\b|fluxo de caixa|cobranc|faturament|boleto|\bbancos?\b|\bpagar\b|\breceber\b|recebimento|saldo/ },
    { nome: 'RH', nomeRe: /\brh\b|recursos humanos|departamento pessoal|gestao de pessoas/, temaRe: /contrat\w* (de )?(funcionari|colaborador|pessoa)|admiss|demiss|\bclt\b|avulso|diarist|folha de pagamento|ponto eletronico|vinculo|presenca|\bdiarias?\b|\bpessoal\b/ },
    { nome: 'Compras', nomeRe: /\bcompras?\b|suprimentos/, temaRe: /fornecedor|cotac|pedido de compra|aquisic/ },
    { nome: 'Administrativo', nomeRe: /administrativ|administrac|admintrac|\badmin\b|\badm\b/, temaRe: /arquivo de documentos|protocolo/ },
    { nome: 'Comercial', nomeRe: /comercial|\bvendas\b/, temaRe: /vendedor|proposta comercial|carteira de clientes/ },
    { nome: 'Operacional', nomeRe: /\boperacional\b|setor de operacoes|area de operacoes|\bproducao\b/, temaRe: /ordem de servico|execucao do servico|equipe de campo|canteiro/ },
    { nome: 'Licitações', nomeRe: /licitac/, temaRe: /edital|editais|pregao|certame|habilitac|certid/ },
    { nome: 'Contratos', nomeRe: /\bcontratos\b(?! de trabalho| clt)|gestao de contratos/, temaRe: /\bcontrato\b(?! de trabalho| clt)|medic|empenho|aditivo|vigencia|reajuste/ },
    { nome: 'Estoque e logística', nomeRe: /estoque|almoxarifado|logistica|expedicao/, temaRe: /inventario|frete|entrega de material/ },
    { nome: 'Contabilidade e prestação de contas', nomeRe: /contabil|contabilidade|prestacao de contas|\bfiscal\b/, temaRe: /nota fiscal|nf-?e|imposto|tribut|prestar contas|tribunal de contas|regime tributario/ },
    { nome: 'TI', nomeRe: /\bti\b|tecnologia da informacao|informatica/, temaRe: /servidor|suporte tecnico/ }
  ];

  /* ---------- Padrões de problema e solução ----------
     Cada padrão exige contexto (não basta uma palavra solta) e ignora frases negadas. */
  const PADROES = [
    {
      id: 'pagamentos', dept: 'Financeiro', titulo: 'Pagamentos executados manualmente',
      detectar: (n) => achar(/pagament|\bpix\b|transferenc/, n) && achar(/manual|um por um|uma a uma|um a um|via mao|a mao|nao (esta )?automatizad|app d[oa]s? bancos?|aplicativo do banco|individualmente/, n),
      causa: 'Cada pagamento é feito individualmente no aplicativo do banco, sem lote e sem integração.',
      impacto: 'O tempo gasto cresce com o volume de pagamentos; há risco de pagamento duplicado, esquecido ou com valor errado, e a conferência do que foi pago é manual.',
      objetivo: 'Pagar em lote, com aprovação registrada antes do envio e conferência automática do retorno do banco.',
      solucao: 'Montar lotes de pagamento a partir do cadastro de beneficiários e enviá-los ao banco por integração (API ou arquivo de remessa, conforme o que o banco oferecer), com aprovação antes do envio e conciliação do retorno.',
      tobe: [['Financeiro', 'Registra ou importa os pagamentos do período'], ['Sistema', 'Valida beneficiários, chaves PIX e valores'], ['Aprovador', 'Aprova o lote'], ['Sistema', 'Envia o lote ao banco'], ['Banco', 'Processa e devolve o retorno'], ['Sistema', 'Concilia pagos e rejeitados e avisa pendências']],
      funcionalidades: [['Cadastro de beneficiários com chave PIX', 'padrao'], ['Montagem de lote de pagamentos', 'especifica'], ['Aprovação do lote antes do envio', 'especifica'], ['Integração bancária para envio de PIX em lote', 'integracao'], ['Conciliação do retorno bancário', 'integracao'], ['Relatório de pagamentos por período e empresa', 'padrao']],
      entidades: [['Beneficiario', ['nome', 'documento', 'chavePix']], ['LotePagamento', ['periodo', 'situacao', 'valorTotal']], ['Pagamento', ['valor', 'situacao', 'dataPagamento']], ['Aprovacao', ['aprovador', 'data', 'decisao']], ['RetornoBancario', ['data', 'situacao', 'motivo']]],
      relacoes: [['LotePagamento', '1', '*', 'Pagamento'], ['Beneficiario', '1', '*', 'Pagamento'], ['LotePagamento', '1', '1', 'Aprovacao'], ['Pagamento', '1', '0..1', 'RetornoBancario']],
      integracoes: ['Banco: envio de PIX em lote e retorno dos pagamentos (meio técnico a confirmar com a instituição)'],
      sequencia: ['Financeiro', 'Sistema', 'Aprovador', 'Banco'],
      atores: [['Financeiro', 'cadastra beneficiários, monta e envia lotes, consulta retornos'], ['Aprovador', 'aprova ou devolve lotes; não edita valores']],
      criterios: (ctx) => [
        'Um lote' + (ctx.volume ? ' com ' + ctx.volume : '') + ' é criado e enviado ao banco sem digitar cada pagamento no aplicativo.',
        'Nenhum lote é enviado sem aprovação registrada.',
        'Pagamentos rejeitados pelo banco aparecem com o motivo, para correção e reenvio.',
        'O relatório do período mostra o total pago por beneficiário.'
      ],
      riscos: ['Depende de o banco oferecer API ou arquivo de remessa para PIX em lote e do contrato com o banco.', 'As chaves PIX dos beneficiários precisam ser coletadas e validadas antes do primeiro lote.'],
      perguntas: ['Quem aprova os pagamentos e há limite de valor por aprovador?', 'Qual banco é usado e se ele oferece API ou arquivo de remessa para PIX.', 'Quantos pagamentos são feitos por semana (confirmar o volume real).']
    },
    {
      id: 'planilha', titulo: 'Controles mantidos em planilhas',
      detectar: (n) => achar(/planilha|excel|google sheets/, n),
      causa: 'As informações são controladas em planilhas, sem base única nem histórico de alterações.',
      impacto: 'Há versões diferentes do mesmo dado, consolidação manual para decidir e risco de perda ou erro de fórmula.',
      objetivo: 'Registrar as informações em base única, com validação e histórico.',
      solucao: 'Substituir as planilhas de controle por cadastros e registros na solução, com validação de campos, histórico e relatórios; importar as planilhas atuais.',
      tobe: [['Usuário do departamento', 'Registra a informação no momento em que ela ocorre'], ['Sistema', 'Valida campos obrigatórios e duplicidades'], ['Usuário do departamento', 'Consulta e filtra pelo histórico'], ['Sistema', 'Emite relatórios sem consolidação manual']],
      funcionalidades: [['Cadastros e registros do departamento em base única', 'padrao'], ['Histórico de alterações', 'padrao'], ['Importação das planilhas atuais', 'especifica'], ['Relatórios e consultas', 'padrao']],
      entidades: [], relacoes: [], integracoes: [],
      atores: [['Usuário do departamento', 'registra e consulta as informações da área']],
      criterios: () => ['As informações hoje em planilha são registradas e consultadas na solução, com histórico de quem alterou.', 'As planilhas atuais são importadas sem redigitação.'],
      riscos: ['Planilhas com formatos diferentes exigem padronização antes da importação.'],
      perguntas: ['Quais planilhas existem, quem as mantém e quais colunas têm.']
    },
    {
      id: 'mensagens', titulo: 'Solicitações e informações trocadas por mensagens',
      detectar: (n) => achar(/whatsapp|\bzap\b|telefone|ligac|e-?mail|mensage/, n),
      causa: 'Pedidos e informações circulam por mensagens, sem registro estruturado.',
      impacto: 'Solicitações se perdem, não há rastreabilidade e as áreas esperam umas pelas outras sem saber a situação.',
      objetivo: 'Registrar as solicitações entre áreas com responsável, situação, prazo e histórico.',
      solucao: 'Fluxo de solicitações entre departamentos, com responsável, situação, prazo, histórico e avisos automáticos.',
      tobe: [['Solicitante', 'Abre a solicitação para o departamento responsável'], ['Sistema', 'Avisa o responsável'], ['Responsável', 'Atende e atualiza a situação'], ['Sistema', 'Avisa o solicitante e registra o histórico']],
      funcionalidades: [['Abertura de solicitação entre departamentos', 'padrao'], ['Acompanhamento de situação e prazo', 'padrao'], ['Avisos automáticos ao responsável e ao solicitante', 'padrao'], ['Histórico da solicitação', 'padrao']],
      entidades: [['Solicitacao', ['assunto', 'situacao', 'prazo']], ['Departamento', ['nome']], ['Usuario', ['nome', 'perfil']]],
      relacoes: [['Departamento', '1', '*', 'Solicitacao'], ['Usuario', '1', '*', 'Solicitacao']],
      integracoes: [],
      atores: [['Solicitante', 'abre e acompanha solicitações'], ['Responsável do departamento', 'atende e atualiza solicitações']],
      criterios: () => ['Toda solicitação entre áreas tem responsável, situação e data, e pode ser consultada depois.'],
      riscos: ['A adesão depende de a equipe deixar de usar mensagens para pedidos formais.'],
      perguntas: ['Quais pedidos entre áreas são mais frequentes hoje por mensagem.']
    },
    {
      id: 'centralizacao', titulo: 'Informação descentralizada',
      detectar: (n) => achar(/centraliz|um (so |unico )?(local|lugar)|em um (so |unico )?sistema|dispers|espalhad/, n),
      causa: 'Os dados estão em vários lugares, sem fonte única.',
      impacto: 'Decisões demoram e há retrabalho para reunir informações.',
      objetivo: 'Concentrar as informações dos departamentos em uma base única.',
      solucao: 'Base única de dados para os departamentos, com painel de indicadores e consultas consolidadas.',
      tobe: [['Departamentos', 'Registram suas informações na mesma base'], ['Gestão', 'Consulta o painel consolidado']],
      funcionalidades: [['Painel de indicadores por departamento', 'padrao'], ['Consultas consolidadas entre departamentos', 'padrao']],
      entidades: [], relacoes: [], integracoes: [],
      atores: [['Gestão', 'consulta painéis e relatórios consolidados']],
      criterios: () => ['A gestão consulta os números dos departamentos em um único painel, sem pedir planilhas às áreas.'],
      riscos: [], perguntas: ['Quais informações a gestão mais precisa consultar e com que frequência.']
    },
    {
      id: 'fluxo_caixa', dept: 'Financeiro', objetivo_: true, titulo: 'Objetivo de melhorar o fluxo de caixa',
      detectar: (n) => achar(/fluxo de caixa/, n),
      causa: 'Não há visão estruturada de entradas e saídas previstas.',
      impacto: 'Dificulta prever falta de caixa e planejar pagamentos.',
      objetivo: 'Dar visão de fluxo de caixa previsto e realizado.',
      solucao: 'Registro de contas a pagar e a receber com fluxo de caixa previsto e realizado por empresa.',
      tobe: [['Financeiro', 'Registra contas a pagar e a receber'], ['Sistema', 'Projeta o fluxo de caixa'], ['Gestão', 'Acompanha previsto e realizado']],
      funcionalidades: [['Contas a pagar e a receber', 'padrao'], ['Fluxo de caixa previsto e realizado', 'padrao']],
      entidades: [['ContaPagar', ['vencimento', 'valor', 'situacao']], ['ContaReceber', ['vencimento', 'valor', 'situacao']]],
      relacoes: [], integracoes: [],
      atores: [['Financeiro', 'registra contas e acompanha o caixa']],
      criterios: () => ['O fluxo de caixa dos próximos 30 dias é consultado a partir das contas registradas.'],
      riscos: [], perguntas: ['Como o fluxo de caixa é acompanhado hoje e por qual período.']
    },
    {
      id: 'contratacao', dept: 'RH', titulo: 'Contratação de colaboradores CLT e avulsos',
      detectar: (n) => achar(/contrat\w*\s+(de\s+)?(funcionari|colaborador|pessoa)|admiss|\bclt\b|avulso/, n),
      causa: 'O cadastro e a contratação de colaboradores não estão estruturados em sistema.',
      impacto: 'Os dados de quem deve ser pago dependem de controles paralelos.',
      objetivo: 'Registrar colaboradores CLT e avulsos em cadastro único, usado também pelos pagamentos.',
      solucao: 'Cadastro de colaboradores por tipo de vínculo (CLT e avulso), com documentos e situação, servindo de base aos pagamentos.',
      tobe: [['RH', 'Cadastra o colaborador e o tipo de vínculo'], ['Sistema', 'Valida dados e documentos'], ['Financeiro', 'Usa o cadastro para montar os pagamentos']],
      funcionalidades: [['Cadastro de colaboradores por tipo de vínculo (CLT e avulso)', 'padrao'], ['Registro de contratação e documentos', 'especifica']],
      entidades: [['Colaborador', ['nome', 'documento', 'tipoVinculo']], ['Contratacao', ['inicio', 'fim', 'situacao']]],
      relacoes: [['Colaborador', '1', '*', 'Contratacao']],
      integracoes: [],
      atores: [['RH', 'cadastra colaboradores e contratações']],
      criterios: () => ['Um colaborador avulso ou CLT é cadastrado uma vez e aparece disponível para pagamento.'],
      riscos: ['Contratação CLT envolve obrigações trabalhistas (folha, eSocial) que podem exigir sistema especializado.'],
      perguntas: ['O que precisa ser registrado na contratação de avulsos e de CLT.', 'A folha de pagamento CLT é feita por contabilidade externa?']
    }
  ];

  /* Padrões para grupos que atuam com contratos públicos e equipes com vínculos variados. */
  PADROES.push(
    {
      id: 'licitacoes', dept: 'Licitações', titulo: 'Gestão de licitações sem controle estruturado',
      detectar: (n) => achar(/licitac|edital|editais|pregao|certame|habilitac|certid/, n),
      causa: 'Editais, documentos de habilitação, propostas e prazos são acompanhados de forma manual ou dispersa.',
      impacto: 'Risco de perder prazos e licitações por certidão vencida ou documento faltante; pouca visão de quantas disputas há e de quantas são vencidas.',
      objetivo: 'Acompanhar cada licitação do edital ao resultado, com prazos, documentos e propostas em um só lugar.',
      solucao: 'Cadastro de licitações com etapas (edital, decisão de participar, proposta, sessão, resultado, recurso), calendário de prazos, controle de documentos e certidões com vencimento por empresa e histórico de resultados.',
      tobe: [['Licitações', 'Registra o edital e a data da sessão'], ['Administradora', 'Decide participar e por qual empresa'], ['Sistema', 'Confere documentos e certidões válidos da empresa'], ['Licitações', 'Monta e registra a proposta de preço'], ['Licitações', 'Registra resultado e recursos'], ['Sistema', 'Licitação vencida gera o contrato']],
      funcionalidades: [['Cadastro e acompanhamento de editais por etapa', 'especifica'], ['Calendário de prazos dos certames com alertas', 'padrao'], ['Controle de documentos e certidões por empresa, com vencimento', 'especifica'], ['Registro de propostas de preço', 'especifica'], ['Resultados, recursos e taxa de vitória', 'padrao']],
      entidades: [['Licitacao', ['orgao', 'numeroEdital', 'dataSessao', 'situacao']], ['Proposta', ['valor', 'situacao']], ['DocumentoHabilitacao', ['tipo', 'validade']]],
      relacoes: [['Licitacao', '1', '*', 'Proposta'], ['Licitacao', '*', '*', 'DocumentoHabilitacao']],
      integracoes: [],
      atores: [['Licitações', 'cadastra editais, documentos e propostas'], ['Administradora', 'decide a participação e aprova o preço']],
      criterios: () => ['Toda licitação em andamento aparece com a próxima data e a empresa participante.', 'O sistema avisa antes do vencimento de cada certidão.', 'Uma licitação vencida vira contrato sem redigitar os dados.'],
      riscos: ['Busca automática de editais em portais depende de cada portal; pode exigir cadastro manual.'],
      perguntas: ['Quem aprova a participação e o preço final?', 'Quais certidões vencem com mais frequência?']
    },
    {
      id: 'contratos_publicos', dept: 'Contratos', titulo: 'Contratos públicos sem gestão centralizada',
      detectar: (n) => achar(/contrato|medic|empenho|aditivo/, n) && achar(/prefeitura|orgao public|publico|municipi|empenho|medic|fiscal do contrato/, n),
      causa: 'Vigências, aditivos, medições, notas e recebimentos de cada contrato são controlados separadamente.',
      impacto: 'Risco de contrato vencer sem renovação, de medição ou nota atrasada e de não saber quanto há a receber de cada prefeitura ou o resultado de cada contrato.',
      objetivo: 'Ter cada contrato com vigência, medições, faturamento, recebimentos e resultado, por empresa e por área.',
      solucao: 'Cadastro de contratos por empresa, área e órgão contratante, com vigência e aditivos, medições e faturamento, acompanhamento de empenhos e recebimentos, e resultado por contrato (receita menos custos de pessoal e materiais).',
      tobe: [['Contratos', 'Registra o contrato e seus aditivos'], ['Operacional', 'Registra a execução do período'], ['Contratos', 'Gera a medição e a nota do período'], ['Financeiro', 'Acompanha empenho e recebimento'], ['Sistema', 'Calcula o resultado do contrato'], ['Sistema', 'Avisa vencimentos e atrasos']],
      funcionalidades: [['Cadastro de contratos por empresa, área e órgão', 'padrao'], ['Vigência, aditivos e reajustes com alertas', 'padrao'], ['Medições e faturamento por contrato', 'especifica'], ['Empenhos, notas e recebimentos por contrato', 'especifica'], ['Resultado por contrato (receitas e custos)', 'especifica']],
      entidades: [['Contrato', ['orgao', 'area', 'vigencia', 'valor']], ['Aditivo', ['tipo', 'data', 'valor']], ['Medicao', ['periodo', 'valor', 'situacao']], ['Recebimento', ['data', 'valor', 'empenho']]],
      relacoes: [['Contrato', '1', '*', 'Aditivo'], ['Contrato', '1', '*', 'Medicao'], ['Medicao', '1', '*', 'Recebimento']],
      integracoes: [],
      atores: [['Contratos', 'cadastra contratos, aditivos e medições'], ['Financeiro', 'acompanha empenhos e recebimentos'], ['Operacional', 'informa a execução']],
      criterios: (ctx) => ['Cada contrato mostra vigência, valor a receber e resultado do período.', 'O sistema avisa com antecedência o vencimento de contratos e aditivos.', 'É possível ver os contratos por empresa, por área e por prefeitura.'],
      riscos: ['Calcular o resultado por contrato exige alocar pessoal e materiais a cada contrato.'],
      perguntas: ['Quais documentos cada prefeitura exige para pagar?', 'Como o custo de pessoal é associado a cada contrato?']
    },
    {
      id: 'diaristas', dept: 'RH', titulo: 'Pessoal com vínculos variados e diárias',
      detectar: (n) => achar(/diarias?\b|diarist|avulso|sem vinculo|informal|por dia trabalhado/, n),
      causa: 'Parte da equipe trabalha por diária ou sem vínculo formal, com presença e valores controlados manualmente.',
      impacto: 'Risco de pagar dias não trabalhados ou deixar de pagar, dificuldade de comprovar pagamentos na prestação de contas e de saber o custo de pessoal por contrato.',
      objetivo: 'Registrar cada trabalhador pelo tipo de vínculo, a presença por local e contrato, e calcular e comprovar os pagamentos.',
      solucao: 'Cadastro de trabalhadores por vínculo (CLT, diarista, avulso), alocação por contrato e local, registro de presença pelo encarregado, cálculo das diárias e envio para pagamento em lote, com comprovantes para a prestação de contas.',
      tobe: [['RH', 'Cadastra o trabalhador e o vínculo'], ['Operacional', 'Aloca no contrato e no local'], ['Encarregado', 'Registra a presença do dia'], ['Sistema', 'Calcula as diárias do período'], ['Financeiro', 'Paga em lote e guarda os comprovantes']],
      funcionalidades: [['Cadastro de trabalhadores por tipo de vínculo', 'padrao'], ['Alocação por contrato e local de trabalho', 'especifica'], ['Registro de presença pelo encarregado (inclusive pelo celular)', 'especifica'], ['Cálculo de diárias por função e período', 'especifica'], ['Custo de pessoal por contrato e por empresa', 'especifica']],
      entidades: [['Trabalhador', ['nome', 'documento', 'tipoVinculo', 'chavePix']], ['Alocacao', ['contrato', 'local', 'inicio', 'fim']], ['Presenca', ['data', 'situacao']], ['Diaria', ['periodo', 'dias', 'valor']]],
      relacoes: [['Trabalhador', '1', '*', 'Alocacao'], ['Alocacao', '1', '*', 'Presenca'], ['Trabalhador', '1', '*', 'Diaria']],
      integracoes: [],
      atores: [['RH', 'cadastra trabalhadores e vínculos'], ['Encarregado', 'registra presença do seu local'], ['Financeiro', 'paga diárias em lote']],
      criterios: () => ['As diárias da semana são calculadas a partir das presenças registradas, sem planilha.', 'Cada pagamento de diária fica ligado ao trabalhador, ao contrato e ao comprovante.', 'O custo de pessoal aparece por contrato e por empresa.'],
      riscos: ['Trabalho por diária recorrente pode ter implicações trabalhistas; recomenda-se orientação jurídica e contábil.', 'Registro de presença em campo depende de celular e de internet ou de uso sem conexão.'],
      perguntas: ['Como o valor da diária é definido e quem aprova?', 'Quem registra a presença em cada local?']
    },
    {
      id: 'prestacao_contas', dept: 'Contabilidade e prestação de contas', titulo: 'Prestação de contas trabalhosa',
      detectar: (n) => achar(/prest\w* (de )?contas|tribunal de contas|prestar contas/, n),
      causa: 'Os documentos da prestação de contas estão espalhados entre áreas, empresas e contratos.',
      impacto: 'Prestação demorada, risco de documento faltante e dificuldade de separar o que é de cada empresa e de cada contrato.',
      objetivo: 'Montar a prestação de contas por empresa, por contrato e do grupo a partir do que já está registrado.',
      solucao: 'Dossiê de prestação de contas por contrato e por empresa, com checklist dos documentos exigidos, anexos ligados a cada lançamento e relatórios consolidados do grupo.',
      tobe: [['Áreas', 'Anexam os documentos ao registrar cada lançamento'], ['Sistema', 'Monta o dossiê por contrato e por empresa'], ['Contabilidade', 'Confere o checklist e completa o que falta'], ['Administradora', 'Aprova e envia a prestação']],
      funcionalidades: [['Dossiê de prestação de contas por contrato e por empresa', 'especifica'], ['Checklist de documentos exigidos', 'padrao'], ['Anexos ligados a cada lançamento', 'padrao'], ['Relatórios por empresa, contrato e grupo', 'padrao']],
      entidades: [['PrestacaoContas', ['periodo', 'destinatario', 'situacao']], ['Documento', ['tipo', 'arquivo', 'origem']]],
      relacoes: [['PrestacaoContas', '1', '*', 'Documento']],
      integracoes: [],
      atores: [['Contabilidade', 'confere e monta a prestação'], ['Administradora', 'aprova e envia']],
      criterios: () => ['A prestação de um contrato reúne automaticamente medições, notas e comprovantes de pagamento do período.', 'É possível emitir a prestação de cada empresa separada e do grupo consolidado.'],
      riscos: ['Formatos exigidos pelo tribunal de contas ou por cada prefeitura precisam ser confirmados.'],
      perguntas: ['Para quem e com que frequência a prestação é enviada?', 'Existe modelo obrigatório de prestação?']
    }
  );

  const padraoArea = (o) => PADROES.push(Object.assign({ relacoes: [], integracoes: [] }, o));
  padraoArea({
    id: 'documentos', dept: 'Administrativo', titulo: 'Documentos sem controle centralizado',
    detectar: (n) => achar(/documento|certid|alvara/, n) && achar(/mistur|espalhad|pastas? fisica|vencem|vencid|sem aviso/, n),
    causa: 'Documentos e validades são guardados em pastas, sem organização única nem aviso.',
    impacto: 'Dificuldade para encontrar documentos e risco de usar documento vencido ou de outra empresa.',
    objetivo: 'Guardar cada documento com tipo, validade e responsável, e encontrá-lo rapidamente.',
    solucao: 'Arquivo digital de documentos, com classificação, validade, avisos e histórico de versões.',
    tobe: [['Administrativo', 'Registra o documento e a validade'], ['Sistema', 'Avisa antes do vencimento'], ['Administrativo', 'Substitui pela nova versão']],
    funcionalidades: [['Arquivo digital de documentos', 'padrao'], ['Alertas de vencimento de documentos', 'padrao'], ['Histórico de versões dos documentos', 'padrao']],
    entidades: [['DocumentoArquivo', ['tipo', 'validade', 'versao']]],
    atores: [['Administrativo', 'registra e atualiza documentos']],
    criterios: () => ['Um documento é encontrado por tipo e validade.', 'O responsável é avisado antes do vencimento.'],
    riscos: ['O acervo atual precisa ser digitalizado e classificado.'], perguntas: ['Quais documentos têm validade e quem é responsável por renová-los?']
  });
  padraoArea({
    id: 'compras', dept: 'Compras', titulo: 'Compras e cotações sem controle estruturado',
    detectar: (n) => achar(/cotac|fornecedor|\bpedidos?\b|quantidades/, n) && achar(/whatsapp|perdem|perdid|historico de precos|a mao|planilha/, n) && achar(/compra|cotac|fornecedor|preco|quantidades/, n),
    causa: 'Pedidos, cotações e preços são tratados por mensagens ou controles manuais.',
    impacto: 'Pedidos podem se perder e não há base para comparar preços.',
    objetivo: 'Acompanhar cada compra do pedido ao recebimento.',
    solucao: 'Fluxo de solicitação, cotação, aprovação, pedido e recebimento, com histórico de preços por fornecedor.',
    tobe: [['Solicitante', 'Registra a necessidade'], ['Compras', 'Registra as cotações'], ['Aprovador', 'Aprova a compra'], ['Compras', 'Emite o pedido'], ['Solicitante', 'Confirma o recebimento']],
    funcionalidades: [['Solicitação de compra', 'padrao'], ['Cotações e histórico de preços', 'padrao'], ['Aprovação da compra', 'especifica'], ['Pedido e recebimento', 'padrao']],
    entidades: [['SolicitacaoCompra', ['item', 'quantidade', 'situacao']], ['Cotacao', ['fornecedor', 'valor']]],
    relacoes: [['SolicitacaoCompra', '1', '*', 'Cotacao']],
    atores: [['Compras', 'registra cotações e pedidos'], ['Aprovador', 'aprova compras'], ['Solicitante', 'pede e confirma o recebimento']],
    criterios: () => ['Todo pedido tem solicitante, situação e histórico.', 'Os preços anteriores de cada fornecedor podem ser consultados.'],
    riscos: ['As equipes precisam deixar de pedir por mensagem.'], perguntas: ['Quem aprova compras e até que valor?', 'Quem confirma o recebimento?']
  });
  padraoArea({
    id: 'execucao', dept: 'Operacional', titulo: 'Registro da execução em papel ou disperso',
    detectar: (n) => achar(/relatorios? de execucao|diario de obra|execucao dos servicos/, n) && achar(/papel|espalhad|celulares|fotos/, n),
    causa: 'A execução é registrada em papel ou em fotos guardadas em aparelhos diferentes.',
    impacto: 'Dificuldade para comprovar o serviço executado.',
    objetivo: 'Registrar a execução no local, com evidências reunidas.',
    solucao: 'Registro digital da execução por local e período, com fotos e conferência do responsável.',
    tobe: [['Encarregado', 'Registra a execução e as fotos'], ['Operacional', 'Confere o registro'], ['Sistema', 'Disponibiliza as evidências']],
    funcionalidades: [['Registro de execução por local', 'especifica'], ['Fotos ligadas à execução', 'padrao'], ['Conferência da execução', 'especifica']],
    entidades: [['Execucao', ['local', 'periodo', 'situacao']]],
    atores: [['Encarregado', 'registra a execução'], ['Operacional', 'confere os registros']],
    criterios: () => ['Cada execução pode ser consultada com local, período e fotos.'],
    riscos: ['O registro em campo pode precisar funcionar sem internet.'], perguntas: ['O que precisa constar no relatório de execução?']
  });

  const QUANT = /(\d[\d.]*)\s+(pix|pagamentos?|pessoas|funcionarios|colaboradores|diaristas|transferencias)\b(?:[^.\n]{0,30}?\b(?:por|na|ao|toda|cada)\s+(semana|mes|dia|quinzena))?/g;

  function analisar(E) {
    const P = R.PERGUNTAS;
    const c = E.cadastro;
    const resp = (id) => t(E.respostas[id] && E.respostas[id].texto);
    const flag = (id) => !!(E.respostas[id] && E.respostas[id].confirmar);
    const fonteQ = (id) => P[id].etapa.titulo + ' › ' + P[id].q;

    /* ---------- 1. Respostas classificadas ---------- */
    const respostas = [];
    R.ETAPAS.filter((e) => e.perguntas).forEach((e) => e.perguntas.filter((p) => R.perguntaVisivel(p, E)).forEach((p) => {
      const texto = resp(p.id);
      respostas.push({ id: p.id, etapa: e.titulo, etapaId: e.id, pergunta: p.q, texto, fonte: fonteQ(p.id), pendente: flag(p.id), classe: classificar(texto, p.descritiva) });
    }));
    Object.keys(E.extras || {}).forEach((eid) => (E.extras[eid] || []).forEach((x) => {
      if (!t(x.pergunta) && !t(x.resposta)) return;
      const et = R.ETAPAS.find((e) => e.id === eid);
      respostas.push({ id: 'x_' + x.id, etapa: et ? et.titulo : 'Complementar', etapaId: eid, pergunta: t(x.pergunta) || 'Pergunta complementar', texto: t(x.resposta), fonte: 'Pergunta complementar › ' + (t(x.pergunta) || 'sem título'), pendente: !!x.confirmar, classe: classificar(x.resposta, true) });
    }));
    const porId = {};
    respostas.forEach((r) => { porId[r.id] = r; });
    const info = (id) => (porId[id] && porId[id].classe === 'informativa' ? porId[id] : null);

    /* ---------- 2. Departamentos ---------- */
    const deps = [];
    const porChave = {};
    function registrarDep(nome, origem, extra) {
      const nn = norm(t(nome));
      if (!nn) return null;
      const cat = CATALOGO.find((k) => k.nomeRe.test(nn));
      const chave = slug(cat ? cat.nome : nome);
      if (porChave[chave]) {
        const d = porChave[chave];
        if (origem === 'cadastrado' && d.origem !== 'cadastrado') { d.origem = 'cadastrado'; d.nome = t(nome); }
        if (extra) Object.assign(d, extra);
        return d;
      }
      const d = Object.assign({
        chave, nome: cat && origem !== 'cadastrado' ? cat.nome : t(nome).replace(/^./, (x) => x.toUpperCase()),
        origem, cat: cat || { nome: t(nome), nomeRe: new RegExp(escRe(nn)), temaRe: null },
        dados: null, responsaveis: [], fatos: [], problemas: [], processos: [], padroes: {}, requisitos: [], regras: [], prioridades: [], pendencias: []
      }, extra || {});
      deps.push(d);
      porChave[chave] = d;
      return d;
    }
    E.departamentos.filter((d) => t(d.nome)).forEach((d) => registrarDep(d.nome, 'cadastrado', { dados: d }));
    const organo = resp('org_organograma');
    if (organo && classificar(organo) !== 'negativa') {
      /* Só uma lista simples de áreas cria departamento fora do catálogo; frase corrida usa apenas o catálogo. */
      const listaSimples = !/[.:;()\d]/.test(organo.replace(/[.\s]+$/, ''));
      norm(organo).split(/,|;|\n|\be\b|\/|\(|\)/).map((x) => x.trim().replace(/\.$/, '')).filter((x) => x && x.split(/\s+/).length <= 3)
        .forEach((tok) => {
          const noCatalogo = CATALOGO.some((k) => k.nomeRe.test(tok));
          if (!noCatalogo && (!listaSimples || /^(na|no|nas|nos|em|um|uma|abaixo|acima|cada|depois|os|as|o|a)\b/.test(tok))) return;
          const ini = norm(organo).indexOf(tok);
          registrarDep(ini >= 0 ? organo.substr(ini, tok.length) : tok, 'citado');
        });
    }
    E.processos.forEach((p) => { if (t(p.departamento)) registrarDep(p.departamento, 'citado'); });

    /* Departamentos citados por nome, só em respostas que tratam de áreas ("estoque pequeno" não é departamento) */
    ['org_organograma', 'org_colaboradores', 'dep_integracao', 'prb_gargalos', 'sis_planilhas', 'req_relatorios', 'sol_prioridades']
      .map((id) => porId[id]).filter((r) => r && r.classe !== 'vazia').forEach((r) => {
        const n = norm(r.texto);
        CATALOGO.forEach((k) => { if (achar(k.nomeRe, n)) registrarDep(k.nome, 'citado'); });
      });

    function depsDoTexto(texto) {
      const n = norm(texto);
      const porNome = deps.filter((d) => achar(d.cat.nomeRe, n));
      if (porNome.length) return { lista: porNome, modo: 'nome' };
      let melhor = 0, escolhidos = [];
      deps.forEach((d) => {
        if (!d.cat.temaRe) return;
        const g = new RegExp(d.cat.temaRe.source, 'g');
        let cont = 0, m;
        while ((m = g.exec(n))) { if (!negado(n, m.index)) cont++; if (!m[0].length) g.lastIndex++; }
        if (cont > melhor) { melhor = cont; escolhidos = [d]; } else if (cont && cont === melhor) escolhidos.push(d);
      });
      return { lista: escolhidos, modo: escolhidos.length ? 'tema' : '' };
    }

    /* Requisitos e prioridades podem tocar várias áreas: soma as citadas pelo nome e as do assunto. */
    function depsAmplo(texto) {
      const n = norm(texto);
      return deps.filter((d) => achar(d.cat.nomeRe, n) || (d.cat.temaRe && achar(d.cat.temaRe, n)));
    }
    const ehDoGrupo = (texto) => (c.grupo || []).length >= 2 && /\bempresas?\b|\bgrupo\b|consolidad/.test(norm(texto));

    /* ---------- 3. Fatos atribuídos ---------- */
    const geral = { fatos: [], problemas: [] };
    const interdep = [];
    const INTERDEP_Q = ['dep_integracao', 'org_comunicacao'];
    function addFato(texto, fonte, pendente, destinoDep, ehProblema, qid) {
      const rot = qid && R.PERGUNTAS[qid] ? R.PERGUNTAS[qid].curto : '';
      const fato = { texto: rot ? rot + ': ' + texto : texto, original: texto, fonte, pendente, modo: destinoDep ? 'nome' : '', qid };
      let alvos = destinoDep ? [destinoDep] : [];
      if (!alvos.length) { const r = depsDoTexto(texto); alvos = r.lista; fato.modo = r.modo; }
      if (!alvos.length) { geral.fatos.push(fato); if (ehProblema) geral.problemas.push(fato); return fato; }
      alvos.forEach((d) => { d.fatos.push(fato); if (ehProblema) d.problemas.push(fato); });
      if (alvos.length >= 2 && fato.modo === 'nome' && INTERDEP_Q.includes(qid)) interdep.push({ texto: fato.texto, fonte, deps: alvos.map((d) => d.nome) });
      fato.deps = alvos;
      return fato;
    }

    const PROBLEMA_Q = ['emp_motivacao', 'pro_criticos', 'prb_principais', 'prb_gargalos', 'prb_retrabalho', 'prb_erros', 'prb_informacao', 'org_comunicacao', 'dep_integracao', 'sis_satisfacao'];
    const CONTEXTO_Q = ['emp_atividade', 'emp_objetivos', 'org_decisao', 'org_terceiros', 'sis_planilhas', 'sis_lista', 'prb_tentativas'];
    PROBLEMA_Q.concat(CONTEXTO_Q).forEach((id) => {
      const r = info(id);
      if (!r) return;
      frases(r.texto).forEach((f) => addFato(f, r.fonte, r.pendente, null, PROBLEMA_Q.includes(id), id));
    });
    respostas.filter((r) => r.id.startsWith('x_') && r.classe === 'informativa')
      .forEach((r) => frases(r.texto).forEach((f) => addFato(f, r.fonte, r.pendente, null, r.etapaId === 'prb')));

    /* Descrições de fotos e documentos anexados também são informação do cliente. */
    (E.anexos || []).filter((x) => t(x.descricao)).forEach((x) => addFato('Anexo “' + t(x.nome) + '”: ' + t(x.descricao), 'Anexo › ' + t(x.nome), false, null, false));

    E.departamentos.filter((d) => t(d.nome)).forEach((dd) => {
      const d = porChave[slug(CATALOGO.find((k) => k.nomeRe.test(norm(dd.nome))) ? CATALOGO.find((k) => k.nomeRe.test(norm(dd.nome))).nome : dd.nome)];
      if (!d) return;
      if (t(dd.responsavel)) d.responsaveis.push({ texto: 'Responsável: ' + t(dd.responsavel), pendente: !!dd.responsavel__confirmar });
      if (t(dd.pessoas)) d.fatos.push({ texto: 'Número de pessoas: ' + t(dd.pessoas), fonte: 'Departamentos › ' + d.nome, pendente: !!dd.pessoas__confirmar, modo: 'nome' });
      [['atividades', 'Atividades'], ['entradas', 'Recebe e entrega'], ['ferramentas', 'Ferramentas'], ['dificuldades', 'Dificuldades']].forEach(([k, rot]) => {
        if (!t(dd[k])) return;
        const cls = classificar(dd[k], k === 'atividades' || k === 'dificuldades');
        const fato = { texto: rot + ': ' + t(dd[k]), fonte: 'Departamentos › ' + d.nome, pendente: !!dd[k + '__confirmar'] || cls === 'vaga', modo: 'nome', campo: k };
        d.fatos.push(fato);
        if (k === 'dificuldades') d.problemas.push(fato);
      });
    });

    c.entrevistados.filter((p) => t(p.nome) && t(p.departamento)).forEach((p) => {
      const r = depsDoTexto(p.departamento);
      const d = r.modo === 'nome' ? r.lista[0] : registrarDep(p.departamento, 'citado');
      if (d) d.responsaveis.push({ texto: 'Entrevistado: ' + [t(p.nome), t(p.cargo)].filter(Boolean).join(' — '), pendente: false });
    });

    /* Processos mapeados */
    const processos = E.processos.filter((p) => t(p.nome) || t(p.etapas)).map((p) => {
      const nome = t(p.nome) || 'Processo sem nome';
      const r = t(p.departamento) ? depsDoTexto(p.departamento) : { lista: [] };
      const dono = r.lista[0] || null;
      const envolvidos = t(p.envolvidos) ? depsDoTexto(p.envolvidos).lista.filter((d) => d !== dono) : [];
      const proc = { id: p.id, nome, dono, envolvidos, dados: p, etapas: frases(p.etapas).length > 1 ? frases(p.etapas) : t(p.etapas).split(/\n+/).map(t).filter(Boolean) };
      if (dono) dono.processos.push(proc);
      envolvidos.forEach((d) => d.processos.push(proc));
      if (envolvidos.length) interdep.push({ texto: 'Processo ' + nome + ': ' + [dono && dono.nome].concat(envolvidos.map((d) => d.nome)).filter(Boolean).join(', '), fonte: 'Processos › ' + nome, deps: [] });
      ['problemas', 'regras'].forEach((k) => {
        if (!t(p[k])) return;
        const alvo = dono ? [dono] : [];
        frases(p[k]).forEach((f) => {
          const fato = { texto: nome + ': ' + f, fonte: 'Processos › ' + nome, pendente: !!p[k + '__confirmar'], modo: 'nome' };
          if (k === 'problemas') { (alvo.length ? alvo[0].problemas : geral.problemas).push(fato); (alvo.length ? alvo[0].fatos : geral.fatos).push(fato); }
          else (alvo.length ? alvo[0].regras : (geral.regras = geral.regras || [])).push(fato);
        });
      });
      return proc;
    });

    /* ---------- 4. Padrões (com evidência e contexto) ---------- */
    const evidencias = [];
    respostas.filter((r) => r.classe === 'informativa' && !/^(req|sol)_/.test(r.id) && r.id !== 'org_organograma').forEach((r) => evidencias.push({ texto: r.texto, fonte: r.fonte, atual: !/^emp_objetivos$/.test(r.id) }));
    E.departamentos.filter((d) => t(d.nome)).forEach((d) => ['atividades', 'ferramentas', 'dificuldades', 'entradas'].forEach((k) => {
      if (t(d[k])) evidencias.push({ texto: t(d[k]), fonte: 'Departamentos › ' + t(d.nome), depNome: t(d.nome), atual: true });
    }));
    E.processos.forEach((p) => ['etapas', 'ferramentas', 'problemas'].forEach((k) => {
      if (t(p[k])) evidencias.push({ texto: t(p[k]), fonte: 'Processos › ' + (t(p.nome) || 'sem nome'), depNome: t(p.departamento), atual: true });
    }));
    (E.anexos || []).filter((x) => t(x.descricao)).forEach((x) => evidencias.push({ texto: t(x.descricao), fonte: 'Anexo › ' + t(x.nome), atual: true }));
    ['req_funcionais', 'sol_preferencia', 'sol_ideal'].forEach((id) => { const r = info(id); if (r) evidencias.push({ texto: r.texto, fonte: r.fonte, atual: false }); });
    // "Quais controles são feitos em planilhas…?" — as áreas citadas usam planilha mesmo sem a palavra na resposta
    const rPlan = info('sis_planilhas');

    const padroesGerais = {};
    function anexarPadrao(d, pad, ev) {
      const alvo = d ? d.padroes : padroesGerais;
      if (!alvo[pad.id]) alvo[pad.id] = { def: pad, evidencias: [] };
      if (!alvo[pad.id].evidencias.some((e) => e.fonte === ev.fonte)) alvo[pad.id].evidencias.push(ev);
    }
    evidencias.forEach((ev) => {
      const n = norm(ev.texto);
      PADROES.forEach((pad) => {
        if (!pad.detectar(n)) return;
        let alvos = [];
        if (ev.depNome) { const r = depsDoTexto(ev.depNome); alvos = r.lista.length ? [r.lista[0]] : []; }
        if (!alvos.length) alvos = depsDoTexto(ev.texto).lista;
        if (pad.dept) {
          // Padrão com departamento próprio vai só para ele, quando o departamento existe.
          const d = deps.find((x) => x.cat.nome === pad.dept);
          if (d) alvos = [d];
        }
        if (!alvos.length) anexarPadrao(null, pad, ev);
        alvos.forEach((d) => anexarPadrao(d, pad, ev));
      });
    });
    if (rPlan) depsDoTexto(rPlan.texto).lista.forEach((d) => anexarPadrao(d, PADROES.find((p) => p.id === 'planilha'), { texto: R.PERGUNTAS.sis_planilhas.curto + ': ' + rPlan.texto, fonte: rPlan.fonte, atual: true }));
    /* "Pessoal com vínculos variados" já cobre o cadastro e a contratação. */
    deps.forEach((d) => { if (d.padroes.diaristas && d.padroes.contratacao) { d.padroes.diaristas.evidencias.push(...d.padroes.contratacao.evidencias); delete d.padroes.contratacao; } });
    /* Padrão genérico em três ou mais áreas vira uma solução única entre departamentos. */
    ['planilha', 'mensagens', 'centralizacao'].forEach((id) => {
      const com = deps.filter((d) => d.padroes[id]);
      if (com.length < 3) return;
      const pad = padroesGerais[id] || (padroesGerais[id] = { def: com[0].padroes[id].def, evidencias: [] });
      com.forEach((d) => {
        d.padroes[id].evidencias.forEach((ev) => { if (!pad.evidencias.some((e) => e.fonte === ev.fonte)) pad.evidencias.push(ev); });
        delete d.padroes[id];
      });
    });
    /* Padrão geral já coberto por algum departamento não vira solução transversal repetida. */
    Object.keys(padroesGerais).forEach((id) => { if (deps.some((d) => d.padroes[id])) delete padroesGerais[id]; });

    /* ---------- 5. Volumes, empresas, aprovação, prazo ---------- */
    /* Só conta como volume de pagamento o número que fala de pagamento na mesma oração;
       total de funcionários não é comparado com pagamentos por semana. */
    const volPag = [];
    respostas.concat(E.departamentos.map((d) => ({ texto: [d.atividades, d.dificuldades].filter(Boolean).join('\n'), fonte: 'Departamentos › ' + t(d.nome) })))
      .forEach((r) => frases(r.texto).flatMap((f) => f.split(/[,;]\s+|\s+e\s+(?=\d)/)).forEach((oracao) => {
        const n = norm(oracao);
        const g = new RegExp(QUANT.source, 'g');
        let m;
        while ((m = g.exec(n))) {
          const direta = /pix|pagament|transfer/.test(m[2]);
          if (!direta && !/pagament|\bpix\b|\bpag[oa]s?\b|\bpagamos\b/.test(n)) continue;
          const periodo = m[3] || (/semana(l|lmente)?\b/.test(n) ? 'semana' : /\bmes\b|mensal/.test(n) ? 'mes' : '');
          volPag.push({ n: Number(m[1].replace(/\./g, '')), unidade: m[2], periodo, trecho: oracao.substr(m.index, m[0].length), fonte: r.fonte });
        }
      }));
    const conflito = volPag.filter((v) => volPag.some((o) => o.n !== v.n && (!o.periodo || !v.periodo || o.periodo === v.periodo)));
    const divergencia = conflito.length ? conflito : null;

    const grupo = (c.grupo || []).filter((x) => t(x.nome));
    const admin = grupo.find((x) => /^administradora/.test(x.papel || '')) || null;
    let multiempresa = grupo.length >= 2
      ? { n: grupo.length, texto: grupo.length + ' empresas cadastradas no grupo' + (admin ? ', com ' + t(admin.nome) + ' como administradora' : ''), fonte: 'Cadastro › Empresas do grupo', doCadastro: true }
      : null;
    if (!multiempresa) respostas.filter((r) => r.classe === 'informativa').some((r) => {
      const m = /(\d+)\s+empresas/.exec(norm(r.texto));
      if (m && Number(m[1]) >= 2) { multiempresa = { n: Number(m[1]), texto: r.texto, fonte: r.fonte }; return true; }
      return false;
    });

    let aprovador = null;
    const rDec = info('org_decisao');
    if (rDec) {
      const m = /\b(ceo|diretor\w*|dono|socio\w*|presidente|gerente geral|proprietari\w*)\b/.exec(norm(rDec.texto));
      if (m) aprovador = { papel: rDec.texto.substr(m.index, m[0].length).toUpperCase() === 'CEO' ? 'CEO' : rDec.texto.substr(m.index, m[0].length), texto: rDec.texto, fonte: rDec.fonte };
    }

    let prazoDias = null;
    const rPrazo = info('sol_prazo');
    if (rPrazo) {
      const m = /(\d+)\s*(dia|semana|mes|meses|ano)/.exec(norm(rPrazo.texto));
      if (m) prazoDias = Number(m[1]) * ({ dia: 1, semana: 7, mes: 30, meses: 30, ano: 365 }[m[2]] || 1);
    }

    const semSistema = (() => {
      const r = porId.sis_lista;
      if (!r || r.classe === 'vazia') return null;
      const n = norm(r.texto);
      if (r.classe === 'negativa' || /^(apenas|so|somente)\s+(planilha|excel)|^planilhas?$|nenhum sistema/.test(n)) return { texto: r.texto, fonte: r.fonte };
      return null;
    })();
    const sistemasAtuais = semSistema ? [] : frases(porId.sis_lista ? porId.sis_lista.texto : '').filter((l) => !/^(apenas|so|somente)?\s*(planilha|excel)/.test(norm(l)));

    /* ---------- 6. Requisitos e regras do cliente ---------- */
    const reqGeral = [];
    function addReq(id, tipo) {
      const r = porId[id];
      if (!r || r.classe === 'vazia') return;
      frases(r.texto).forEach((f) => {
        const vaga = r.classe === 'vaga' || r.classe === 'desconhecida';
        const req = { texto: f, fonte: r.fonte, pendente: r.pendente || vaga, vaga, negativa: r.classe === 'negativa', tipo, qid: id };
        const alvo = tipo === 'RF' ? depsAmplo(f) : [];
        if (alvo.length && tipo === 'RF') alvo.forEach((d) => d.requisitos.push(req));
        reqGeral.push(Object.assign({ deps: alvo.map((d) => d.nome).concat(tipo === 'RF' && ehDoGrupo(f) ? ['Estrutura multiempresa'] : []) }, req));
      });
    }
    addReq('req_funcionais', 'RF'); addReq('req_relatorios', 'RF');
    ['req_usuarios', 'req_acesso', 'req_seguranca', 'req_desempenho'].forEach((id) => addReq(id, 'RNF'));
    const regrasGerais = [];
    const rRegras = porId.req_regras;
    if (rRegras && rRegras.classe !== 'vazia') {
      frases(rRegras.texto).forEach((f) => {
        const vaga = rRegras.classe === 'vaga';
        const regra = { texto: f, fonte: rRegras.fonte, pendente: rRegras.pendente || vaga, vaga };
        const alvo = depsDoTexto(f).lista;
        alvo.forEach((d) => d.regras.push(regra));
        regrasGerais.push(Object.assign({ deps: alvo.map((d) => d.nome) }, regra));
      });
    }

    /* Prioridades do cliente, na ordem informada */
    const prioridades = [];
    const rPri = porId.sol_prioridades;
    if (rPri && rPri.classe === 'informativa') {
      frases(rPri.texto).forEach((f, i) => {
        const alvo = depsAmplo(f);
        alvo.forEach((d) => { if (!d.prioridades.length) d.prioridades.push({ ordem: i + 1, texto: f, fonte: rPri.fonte, pendente: rPri.pendente }); });
        prioridades.push({ ordem: i + 1, texto: f, fonte: rPri.fonte, pendente: rPri.pendente, deps: alvo.map((d) => d.nome).concat(ehDoGrupo(f) ? ['Estrutura multiempresa'] : []) });
      });
    }

    /* ---------- 7. Pendências ---------- */
    const pendencias = { semResposta: [], vagas: [], desconhecidas: [], marcadas: [], divergencias: [], esclarecer: [] };
    respostas.forEach((r) => {
      if (r.classe === 'vazia') pendencias.semResposta.push(r);
      else if (r.classe === 'vaga') pendencias.vagas.push(r);
      else if (r.classe === 'desconhecida') pendencias.desconhecidas.push(r);
      else if (r.pendente) pendencias.marcadas.push(r);
    });
    if (divergencia) pendencias.divergencias.push({ texto: 'Volumes diferentes informados para pagamentos: ' + divergencia.map((v) => '“' + v.trecho + '” (' + v.fonte + ')').join('; ') + '. Confirmar o volume real.', fonte: 'Análise das respostas' });

    /* Departamentos ordenados: prioridade do cliente, depois os que têm mais conteúdo */
    deps.forEach((d) => { d.ordem = d.prioridades.length ? d.prioridades[0].ordem : 99; d.peso = Object.keys(d.padroes).length * 3 + d.problemas.length * 2 + d.fatos.length + d.requisitos.length; });
    deps.sort((a, b) => a.ordem - b.ordem || b.peso - a.peso);

    return {
      respostas, porId, deps, geral, interdep, processos, padroesGerais, PADROES,
      volumes: volPag, divergencia, multiempresa, grupo, admin, aprovador, prazoDias, semSistema, sistemasAtuais,
      reqGeral, regrasGerais, prioridades, pendencias,
      classe: (id) => (porId[id] ? porId[id].classe : 'vazia'),
      resposta: (id) => porId[id] || null
    };
  }

  R.analise = { analisar, classificar, norm, slug, frases };
})();
