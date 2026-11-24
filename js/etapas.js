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
        { id: 'emp_atividade', ex: ["Prestação de serviços para órgãos públicos", "Comércio varejista de materiais", "Fabricação sob encomenda", "Distribuição para revendas"], curto: 'Atividade', descritiva: true, q: 'O que a empresa faz? Quais produtos ou serviços oferece?' },
        { id: 'emp_historia', ex: ["Menos de 2 anos", "Entre 5 e 10 anos", "Mais de 20 anos, empresa familiar", "Cresceu com novas filiais"], curto: 'Tempo de atuação', q: 'Há quanto tempo atua e como evoluiu até hoje?' },
        { id: 'emp_clientes', ex: ["Prefeituras e órgãos públicos, via licitação", "Empresas da região, por indicação", "Consumidor final, pela loja e redes sociais", "Revendedores, por representantes"], curto: 'Principais clientes', q: 'Quem são os principais clientes e como chegam até a empresa?' },
        { id: 'emp_unidades', ex: ["Uma unidade só", "Matriz e 2 filiais na mesma cidade", "Várias empresas do mesmo grupo", "Equipes trabalhando em campo"], curto: 'Unidades e empresas', q: 'Quantas unidades, filiais ou pontos de operação existem? Onde ficam?' },
        { id: 'emp_volume', ex: ["Cerca de 200 pedidos por mês", "50 contratos ativos", "100 pagamentos por semana", "30 atendimentos por dia"], curto: 'Volume da operação', q: 'Qual o volume aproximado da operação?', ajuda: 'Pedidos, atendimentos, notas, ordens ou contratos por mês.' },
        { id: 'emp_objetivos', ex: ["Melhorar o fluxo de caixa", "Crescer sem aumentar a equipe", "Reduzir erros e retrabalho", "Abrir novas unidades"], curto: 'Objetivos', q: 'Quais são os objetivos da empresa para os próximos 12 a 24 meses?' },
        { id: 'emp_motivacao', ex: ["Controles em planilhas não dão mais conta", "Erros em pagamentos ou cobranças", "Crescimento da operação", "Exigência de cliente ou órgão público"], curto: 'Motivação', descritiva: true, q: 'O que motivou a busca por uma solução neste momento?' }
      ]
    },
    {
      id: 'org', titulo: 'Estrutura organizacional',
      desc: 'Hierarquia, decisões e comunicação entre áreas.',
      perguntas: [
        { id: 'org_organograma', ex: ["Diretoria, Financeiro, Compras, Comercial e Operacional", "Sócios e uma equipe administrativa", "Matriz centraliza e filiais executam"], curto: 'Áreas', q: 'Como a empresa está organizada? Descreva a hierarquia e as áreas.' },
        { id: 'org_colaboradores', ex: ["10 no total", "Cerca de 50, a maioria na operação", "5 no escritório e 40 em campo"], curto: 'Colaboradores', q: 'Quantos colaboradores há no total e em cada área?' },
        { id: 'org_decisao', ex: ["O dono decide tudo", "Diretor aprova acima de um valor", "Gerente de cada área aprova", "Sócios decidem em reunião"], curto: 'Decisões e aprovações', descritiva: true, q: 'Quem toma as decisões e como elas são aprovadas?', ajuda: 'Alçadas, aprovações financeiras, quem assina.' },
        { id: 'org_terceiros', ex: ["Contabilidade externa", "Mão de obra terceirizada", "Transporte e entregas", "Não há"], curto: 'Terceirização', q: 'Há atividades terceirizadas? Quais e com quem?' },
        { id: 'org_comunicacao', ex: ["Por WhatsApp", "Por e-mail e planilhas compartilhadas", "Pessoalmente ou por telefone", "Reunião semanal"], curto: 'Comunicação entre áreas', descritiva: true, q: 'Como as áreas se comunicam e trocam informações no dia a dia?' }
      ]
    },
    {
      id: 'dep', titulo: 'Departamentos', lista: 'departamentos',
      desc: 'Cadastre cada área visitada com suas atividades e dificuldades.',
      perguntas: [
        { id: 'dep_integracao', ex: ["Compras depende do Financeiro para pagar", "Comercial depende do estoque", "A informação chega atrasada ao Financeiro"], curto: 'Dependência entre áreas', q: 'Quais áreas dependem mais umas das outras? Onde a passagem de informação atrasa?' }
      ]
    },
    {
      id: 'pro', titulo: 'Processos', lista: 'processos',
      desc: 'Mapeie como cada processo funciona hoje (AS-IS).',
      perguntas: [
        { id: 'pro_criticos', ex: ["Pagamentos", "Faturamento e cobrança", "Compras e cotações", "Participação em licitações", "Folha e contratação"], curto: 'Processos críticos', descritiva: true, q: 'Quais processos são mais críticos para o negócio?' },
        { id: 'pro_indicadores', ex: ["Faturamento mensal", "Contas a pagar e a receber", "Prazo de entrega", "Nenhum indicador formal"], curto: 'Indicadores', q: 'Quais indicadores ou controles são acompanhados hoje? Como são calculados?' }
      ]
    },
    {
      id: 'prb', titulo: 'Problemas',
      desc: 'Problemas, gargalos, erros e retrabalho relatados.',
      perguntas: [
        { id: 'prb_principais', ex: ["Muito trabalho manual", "Informação espalhada em planilhas", "Atrasos em pagamentos", "Erros de digitação", "Falta de controle de prazos"], curto: 'Principais problemas', descritiva: true, q: 'Quais são os principais problemas enfrentados hoje?' },
        { id: 'prb_gargalos', ex: ["Aprovações dependem de uma pessoa", "Tudo passa pelo Financeiro", "Conferência manual de documentos", "Espera por informação de outra área"], curto: 'Gargalos', descritiva: true, q: 'Onde estão os gargalos?', ajuda: 'Etapas que atrasam, acumulam trabalho ou dependem de uma única pessoa.' },
        { id: 'prb_retrabalho', ex: ["Os mesmos dados são digitados em mais de um lugar", "Planilhas paralelas em cada área", "Pedidos por WhatsApp redigitados", "Conferência repetida"], curto: 'Retrabalho', descritiva: true, q: 'Há retrabalho, digitação repetida ou controles paralelos?', ajuda: 'Planilhas, papel, mensagens, lançamentos em mais de um lugar.' },
        { id: 'prb_erros', ex: ["Pagamento em duplicidade ou com valor errado", "Perda de prazo", "Pedido com informação errada", "Multas e juros por atraso"], curto: 'Erros frequentes', descritiva: true, q: 'Quais erros acontecem com frequência e qual o impacto?', ajuda: 'Financeiro, cliente, prazo, multa.' },
        { id: 'prb_informacao', ex: ["Saldo e fluxo de caixa atualizados", "Situação dos pedidos", "Custos por contrato", "Desempenho de cada área"], curto: 'Informação para decisão', descritiva: true, q: 'Que informações faltam ou demoram para a tomada de decisão?' },
        { id: 'prb_tentativas', ex: ["Nada até agora", "Tentou um sistema que não se adaptou", "Criou planilhas mais completas", "Contratou mais pessoas"], curto: 'Tentativas anteriores', q: 'O que já foi tentado para resolver esses problemas? Qual foi o resultado?' }
      ]
    },
    {
      id: 'sis', titulo: 'Sistemas atuais',
      desc: 'Sistemas, planilhas, infraestrutura e dados existentes.',
      perguntas: [
        { id: 'sis_lista', ex: ["Apenas planilhas de Excel", "Sistema de gestão (ERP) antigo", "Sistema da contabilidade", "Aplicativo do banco", "WhatsApp e e-mail"], curto: 'Sistemas usados', q: 'Quais sistemas e ferramentas são usados hoje?', ajuda: 'Um por linha: nome, finalidade e área que usa.' },
        { id: 'sis_satisfacao', ex: ["O sistema atual não integra as áreas", "É lento e trava", "Funciona, mas falta relatório", "Não há sistema"], curto: 'Avaliação dos sistemas', descritiva: true, q: 'O que funciona bem e o que não funciona nos sistemas atuais?' },
        { id: 'sis_planilhas', ex: ["Financeiro e Compras", "Controle de estoque", "Contas a pagar", "Agenda de prazos"], curto: 'Controles paralelos', q: 'Quais controles são feitos em planilhas, papel ou aplicativos de mensagem?' },
        { id: 'sis_integracoes', ex: ["Não, tudo é digitado de novo", "Banco com o sistema financeiro", "Vendas com estoque", "Sistema com a contabilidade"], curto: 'Integrações atuais', q: 'Os sistemas trocam dados entre si? Quais informações precisariam ser integradas?' },
        { id: 'sis_infra', ex: ["Computadores no escritório e internet estável", "Celulares da equipe", "Servidor local", "Arquivos na nuvem"], curto: 'Infraestrutura', q: 'Como é a infraestrutura?', ajuda: 'Computadores, internet, servidores, nuvem, celulares.' },
        { id: 'sis_contratos', ex: ["Não", "Contrato do sistema atual vence em 6 meses", "Licenças anuais"], curto: 'Contratos de sistema', q: 'Há contratos, licenças ou fornecedores de sistema com prazo ou restrição?' },
        { id: 'sis_dados', ex: ["Cadastro de clientes e fornecedores", "Histórico de pagamentos", "Contratos ativos", "Não precisa aproveitar"], curto: 'Dados históricos', q: 'Quais dados históricos precisam ser aproveitados em uma nova solução?' }
      ]
    },
    {
      id: 'req', titulo: 'Requisitos',
      desc: 'O que a solução precisa fazer e como precisa funcionar.',
      perguntas: [
        { id: 'req_funcionais', ex: ["Cadastrar clientes, fornecedores e colaboradores", "Fazer pagamentos em lote", "Controlar contas a pagar e a receber", "Acompanhar prazos com alertas", "Aprovar pedidos"], curto: 'Necessidades', descritiva: true, q: 'O que a solução precisa fazer?', ajuda: 'Uma necessidade por linha.' },
        { id: 'req_relatorios', ex: ["Fluxo de caixa", "Pagamentos por período", "Relatório por empresa ou filial", "Painel com indicadores"], curto: 'Relatórios', q: 'Quais relatórios, documentos ou indicadores a solução deve emitir?' },
        { id: 'req_regras', ex: ["Pagamento acima de um valor precisa de aprovação do diretor", "Vencimento sempre em dia útil", "Desconto máximo de 10%", "Prazo de 5 dias para responder"], curto: 'Regras de negócio', descritiva: true, q: 'Quais regras de negócio devem ser respeitadas?', ajuda: 'Cálculos, políticas, alçadas, prazos e restrições. Uma por linha.' },
        { id: 'req_usuarios', ex: ["5 usuários no escritório", "Diretor só consulta e aprova", "Cada área vê apenas seus dados", "Equipe de campo pelo celular"], curto: 'Usuários e perfis', q: 'Quem vai usar a solução? Quantos usuários e com quais perfis de acesso?' },
        { id: 'req_acesso', ex: ["No escritório, pelo computador", "No celular, em campo", "Fora da empresa", "Em locais sem internet"], curto: 'Local de uso', q: 'Onde e como será usada?', ajuda: 'Escritório, campo, celular, locais sem internet.' },
        { id: 'req_seguranca', ex: ["Dados pessoais de colaboradores (LGPD)", "Registro de quem alterou o quê", "Prestação de contas a órgão público", "Não há exigência específica"], curto: 'Segurança e LGPD', q: 'Há exigências de segurança, privacidade (LGPD), auditoria ou legislação específica?' },
        { id: 'req_desempenho', ex: ["Funcionar o dia todo, sem interrupção", "Cerca de 500 lançamentos por semana", "Guardar 5 anos de histórico"], curto: 'Desempenho e volume', descritiva: true, q: 'Há expectativas de disponibilidade, desempenho ou volume de dados?' }
      ]
    },
    {
      id: 'sol', titulo: 'Solução desejada',
      desc: 'Expectativas, prioridades, prazo e restrições do cliente.',
      perguntas: [
        { id: 'sol_ideal', ex: ["Tudo em um só lugar", "Lançar uma vez e todos verem", "Pagamentos automáticos com aprovação", "Alertas antes dos prazos"], curto: 'Funcionamento ideal', descritiva: true, q: 'Como o cliente imagina o funcionamento ideal dos processos?' },
        { id: 'sol_expectativa', ex: ["Reduzir o tempo gasto com pagamentos", "Acabar com as planilhas", "Ter relatórios em tempo real", "Menos erros"], curto: 'Expectativa de sucesso', descritiva: true, q: 'O que o cliente espera de uma nova solução? Como vai medir o sucesso?' },
        { id: 'sol_preferencia', ex: ["Sem preferência, o que resolver melhor", "Sistema pronto de mercado", "Sistema sob medida", "Começar automatizando uma parte"], curto: 'Preferência de solução', q: 'Há preferência por algum tipo de solução? Por quê?', ajuda: 'Sistema próprio, sistema de mercado, aplicativo, automação, integração ou nenhuma.' },
        { id: 'sol_prioridades', ex: ["Financeiro", "Pagamentos", "Compras", "Controle de prazos"], curto: 'Prioridades', q: 'O que é mais urgente resolver?', ajuda: 'Uma prioridade por linha, da mais para a menos urgente.' },
        { id: 'sol_prazo', ex: ["Em 3 meses", "Antes do início do ano", "Sem prazo definido", "Por fases"], curto: 'Prazo', q: 'Existe prazo desejado ou data limite para a implantação?' },
        { id: 'sol_orcamento', ex: ["Ainda não definido", "Até R$ 5 mil por mês", "Investimento único previsto", "Depende da proposta"], curto: 'Orçamento', q: 'Há orçamento previsto ou faixa de investimento?' },
        { id: 'sol_restricoes', ex: ["Equipe com pouca familiaridade com sistemas", "Não quer depender de um único fornecedor", "Não pode parar a operação", "Nenhuma"], curto: 'Restrições', q: 'Há restrições ou receios?', ajuda: 'Mudança de rotina, treinamento, dependência de fornecedor.' }
      ]
    },
    {
      id: 'diagnostico', tipo: 'diagnostico', titulo: 'Diagnóstico',
      desc: 'Relatório de diagnóstico e proposta de solução, editável, com validação por departamento.'
    }
  ];

  R.CAMPOS_DEPARTAMENTO = [
    { campo: 'responsavel', rotulo: 'Responsável', linha: true },
    { campo: 'onde', rotulo: 'Onde funciona no grupo', linha: true, opcoes: 'ONDE_FUNCIONA', modulo: 'grupo' },
    { campo: 'pessoas', rotulo: 'Número de pessoas', linha: true },
    { campo: 'atividades', rotulo: 'Principais atividades', ex: ["Pagamentos e cobranças", "Cotação e compra de materiais", "Contratação de pessoas", "Emissão de notas"] },
    { campo: 'entradas', rotulo: 'Informações que recebe e que entrega a outras áreas', ex: ["Recebe pedidos de compra e entrega comprovantes", "Recebe notas e repassa ao Financeiro"] },
    { campo: 'ferramentas', rotulo: 'Ferramentas e sistemas usados', ex: ["Planilhas de Excel", "Aplicativo do banco", "WhatsApp", "Sistema de gestão"] },
    { campo: 'dificuldades', rotulo: 'Dificuldades da área', ex: ["Trabalho manual repetitivo", "Falta de informação no prazo", "Depende de uma única pessoa", "Muitos controles paralelos"] }
  ];

  R.CAMPOS_PROCESSO = [
    { campo: 'departamento', rotulo: 'Departamento responsável', linha: true, lista: 'dl_departamentos' },
    { campo: 'envolvidos', rotulo: 'Outros departamentos envolvidos', linha: true, lista: 'dl_departamentos' },
    { campo: 'gatilho', rotulo: 'Como o processo começa', ex: ["Pedido de outra área", "Data fixa (toda semana ou mês)", "Solicitação do cliente", "Chegada de nota ou documento"] },
    { campo: 'etapas', rotulo: 'Passo a passo atual', ex: ["1. Recebe a solicitação\n2. Confere os dados\n3. Pede aprovação\n4. Executa\n5. Arquiva o comprovante"] },
    { campo: 'executores', rotulo: 'Quem executa e quem aprova', ex: ["Financeiro executa, diretor aprova", "Comprador executa, gerente aprova"] },
    { campo: 'ferramentas', rotulo: 'Sistemas, planilhas e documentos usados', ex: ["Planilha de controle", "Aplicativo do banco", "E-mail e WhatsApp", "Notas fiscais em papel"] },
    { campo: 'volume', rotulo: 'Frequência e volume', ex: ["100 por semana", "Diário", "Uma vez por mês"] },
    { campo: 'tempo', rotulo: 'Tempo médio de execução', ex: ["Cerca de 2 horas", "Um dia inteiro", "Alguns minutos por item"] },
    { campo: 'regras', rotulo: 'Regras e exceções', ex: ["Acima de R$ 5 mil precisa de aprovação", "Urgências pulam a fila", "Só paga com nota fiscal"] },
    { campo: 'problemas', rotulo: 'Problemas e retrabalho', ex: ["Digitação repetida", "Atrasos na aprovação", "Erros de valor", "Falta de histórico"] }
  ];

  /* ---------- Módulos de perguntas (ativados no Cadastro conforme o cliente) ---------- */
  R.MODULOS = [
    { id: 'grupo', titulo: 'Grupo com várias empresas', desc: 'Empresa administradora e empresas operacionais, separação e consolidação.' },
    { id: 'pessoal', titulo: 'Equipes com vínculos variados', desc: 'CLT, diaristas, avulsos e terceirizados; presença, diárias e alocação.' },
    { id: 'publico', titulo: 'Licitações e contratos públicos', desc: 'Editais, propostas, contratos com órgãos públicos, medições e recebimentos.' },
    { id: 'prestacao', titulo: 'Prestação de contas e contabilidade', desc: 'Para quem, com que documentos, por empresa e por contrato.' },
    { id: 'areas', titulo: 'Operação em várias áreas de serviço', desc: 'Áreas com processos próprios (ex.: alimentação, construção, saúde, educação).' }
  ];

  const P = (id, modulo, curto, q, ex, opc) => Object.assign({ id, modulo, curto, q, ex, essencial: true }, opc || {});
  const MOD_PERGUNTAS = {
    org: [
      P('grp_segregacao', 'grupo', 'Separação entre empresas', 'Cada empresa tem CNPJ, conta bancária e contabilidade próprias?', ['Sim, tudo separado por empresa', 'CNPJs separados, mas uma conta bancária só', 'A contabilidade é única para o grupo']),
      P('grp_admin_receita', 'grupo', 'Operação própria da administradora', 'A administradora tem receitas, despesas, contratos e funcionários próprios? Como separa isso da gestão do grupo?', ['Tem contratos próprios com prefeituras', 'Só faz a gestão, sem operação', 'Hoje tudo fica misturado na mesma planilha'], { descritiva: true }),
      P('grp_cobranca', 'grupo', 'Remuneração da administradora', 'Como a administradora é remunerada pelas outras empresas?', ['Taxa de administração mensal', 'Rateio das despesas comuns', 'Não há cobrança formal']),
      P('grp_intercompany', 'grupo', 'Transações entre empresas', 'Há empréstimos, repasses, funcionários ou despesas compartilhados entre as empresas? Como são registrados?', ['Repasses de dinheiro entre contas', 'Funcionários trabalham para mais de uma empresa', 'Despesas pagas por uma e usadas por outra', 'Não são registrados']),
      P('grp_consolidado', 'grupo', 'Visão consolidada', 'Que informações a administradora precisa ver de todo o grupo? O que deve ficar visível só em cada empresa?', ['Saldo e fluxo de caixa de cada empresa e do grupo', 'Contratos ativos e a receber', 'Custo de pessoal por empresa', 'Resultado por contrato']),
      P('grp_acessos', 'grupo', 'Acessos por empresa', 'Quem vê todas as empresas e quem vê só a sua?', ['Diretoria vê tudo', 'Cada gerente vê só a sua empresa', 'Financeiro central vê todas']),
      P('grp_decisoes', 'grupo', 'Decisões centralizadas', 'Quais decisões das empresas operacionais dependem da administradora?', ['Participar de licitação', 'Pagamentos acima de um valor', 'Contratação de pessoal', 'Compras grandes']),
      P('pes_vinculos', 'pessoal', 'Vínculos de trabalho', 'Quantos funcionários há por tipo de vínculo (CLT, diaristas, avulsos, terceirizados) e por empresa?', ['80 CLT e 300 diaristas', 'A maioria é diarista', 'Varia conforme os contratos ativos']),
      P('pes_contratacao', 'pessoal', 'Contratação por vínculo', 'Como é feita a contratação de cada tipo de vínculo? Quais documentos são exigidos?', ['CLT pela contabilidade, diarista por recibo', 'Documentos pessoais e chave PIX', 'Não há contrato com diaristas']),
      P('pes_alocacao', 'pessoal', 'Alocação de pessoal', 'Como os funcionários são alocados por contrato, obra, escola ou unidade de saúde?', ['Cada equipe fica fixa em um contrato', 'Remanejados conforme a demanda', 'Controle em planilha por local']),
      P('pes_presenca', 'pessoal', 'Controle de presença', 'Como é controlada a presença? Quem informa e quando?', ['Lista assinada no local', 'Encarregado manda por WhatsApp', 'Ponto eletrônico para CLT', 'Não há controle formal']),
      P('pes_diarias', 'pessoal', 'Cálculo das diárias', 'Como é calculado e pago o valor das diárias? Há variação por função ou local?', ['Valor fixo por dia trabalhado', 'Varia por função', 'Pago por PIX toda semana']),
      P('pes_compartilhado', 'pessoal', 'Funcionário em mais de uma empresa', 'Um funcionário pode trabalhar para mais de uma empresa do grupo? Como é registrado?', ['Sim, sem registro de rateio', 'Não, cada um em uma empresa', 'Sim, cada empresa paga sua parte']),
      P('pes_encargos', 'pessoal', 'Folha e encargos', 'Como são tratados folha CLT, encargos e eSocial?', ['Contabilidade externa faz a folha', 'Departamento pessoal interno', 'Não sei'])
    ],
    pro: [
      P('lic_editais', 'publico', 'Origem dos editais', 'De onde vêm os editais e quem decide participar?', ['Portais de compras e diários oficiais', 'Um funcionário procura diariamente', 'A diretoria decide']),
      P('lic_volume', 'publico', 'Volume de licitações', 'Quantas licitações por mês o grupo acompanha e disputa? Quantas vence?', ['Acompanha 30 e disputa 10 por mês', 'Vence cerca de 3 por mês']),
      P('lic_documentos', 'publico', 'Documentos de habilitação', 'Quais documentos e certidões são exigidos para habilitação? Como controlam os vencimentos?', ['Certidões federal, estadual, municipal, FGTS e trabalhista', 'Pasta com documentos por empresa', 'Já perdeu licitação por certidão vencida']),
      P('lic_propostas', 'publico', 'Propostas de preço', 'Como são montadas as propostas de preço? Quem aprova?', ['Planilha de custos com BDI', 'Composição por item do edital', 'Diretoria aprova o preço final']),
      P('lic_resultados', 'publico', 'Resultados e recursos', 'Como acompanham resultados, recursos e prazos dos certames?', ['Acompanha no portal todos os dias', 'Planilha com prazos', 'Advogado cuida dos recursos']),
      P('ctr_ativos', 'publico', 'Contratos ativos', 'Quantos contratos ativos há por empresa e por área?', ['12 contratos, a maioria em alimentação', 'Cada empresa tem de 2 a 5 contratos']),
      P('ctr_gestao', 'publico', 'Vigência e aditivos', 'Como controlam vigência, aditivos, reajustes e garantias dos contratos?', ['Planilha com datas de vencimento', 'Alerta manual na agenda', 'Já houve contrato vencido sem renovação']),
      P('ctr_medicao', 'publico', 'Medição e faturamento', 'Como é feita a medição e o faturamento de cada contrato? Que documentos a prefeitura exige para pagar?', ['Medição mensal com relatório e fotos', 'Nota fiscal mais certidões e folha de pessoal', 'Boletim de medição assinado pelo fiscal']),
      P('ctr_recebimento', 'publico', 'Empenhos e recebimentos', 'Como acompanham empenhos, notas emitidas e pagamentos das prefeituras? Há atrasos?', ['Atrasos de 60 a 90 dias são comuns', 'Planilha de notas a receber', 'Não há controle por empenho']),
      P('ctr_resultado', 'publico', 'Resultado por contrato', 'Sabem o resultado de cada contrato (receita menos custos de pessoal e materiais)?', ['Não, só o resultado geral', 'Calculam em planilha no fim do mês', 'Sim, por contrato']),
      P('ar_diferencas', 'areas', 'Diferenças entre áreas', 'As áreas de serviço funcionam de forma diferente? O que muda em cada uma?', ['Construção tem medição e diário de obra', 'Alimentação depende de cardápio e entregas', 'Saúde e educação alocam profissionais']),
      P('ar_alimentacao', 'areas', 'Área de alimentação', 'Alimentação: como funcionam cardápios, compra de insumos, entregas e controle nas unidades?', ['Cardápio definido pela prefeitura', 'Compra semanal de perecíveis', 'Entrega diária nas escolas']),
      P('ar_construcao', 'areas', 'Área de construção', 'Construção: como funcionam orçamento, medições, diário de obra e compra de materiais?', ['Orçamento pela tabela oficial', 'Medição mensal pelo fiscal', 'Diário de obra em papel']),
      P('ar_saude_educacao', 'areas', 'Saúde e educação', 'Saúde e educação: quais serviços são prestados e como são controlados?', ['Profissionais alocados em escolas e postos', 'Escalas mensais', 'Relatórios de atendimento']),
      P('ar_compras', 'areas', 'Compras e estoque', 'As compras são centralizadas ou feitas por empresa ou contrato? Há estoque?', ['Centralizadas na administradora', 'Cada contrato compra o seu', 'Estoque de materiais e alimentos'])
    ],
    req: [
      P('pc_destinatarios', 'prestacao', 'Destinatários da prestação de contas', 'Para quem a prestação de contas é feita?', ['Sócios', 'Prefeituras contratantes', 'Tribunal de contas', 'Bancos']),
      P('pc_nivel', 'prestacao', 'Nível e frequência da prestação', 'A prestação é feita por empresa, por contrato ou pelo grupo? Com que frequência?', ['Mensal, por contrato', 'Anual, por empresa', 'Consolidada do grupo para os sócios']),
      P('pc_documentos', 'prestacao', 'Documentos da prestação', 'Quais documentos compõem a prestação de contas?', ['Medições e notas fiscais', 'Comprovantes de pagamento de pessoal', 'Certidões negativas', 'Relatórios fotográficos']),
      P('pc_dificuldade', 'prestacao', 'Dificuldades na prestação', 'O que mais dá trabalho ou atrasa na prestação de contas hoje?', ['Juntar documentos de várias pessoas', 'Separar o que é de cada contrato', 'Comprovar pagamento de diaristas'], { descritiva: true }),
      P('pc_contabil', 'prestacao', 'Regime e contabilidade', 'Qual o regime tributário de cada empresa? A contabilidade é interna ou externa?', ['Lucro presumido, contabilidade externa', 'Simples Nacional em algumas empresas', 'Não sei'])
    ]
  };
  Object.keys(MOD_PERGUNTAS).forEach((eid) => {
    const e = R.ETAPAS.find((x) => x.id === eid);
    e.perguntas.push(...MOD_PERGUNTAS[eid]);
  });

  /* Perguntas essenciais da base: entram na conferência de lacunas. */
  ['emp_atividade', 'emp_volume', 'org_organograma', 'org_decisao', 'pro_criticos', 'prb_principais', 'sis_lista', 'req_funcionais', 'req_regras', 'req_usuarios', 'sol_prioridades', 'sol_prazo', 'sol_orcamento']
    .forEach((id) => { R.ETAPAS.forEach((e) => (e.perguntas || []).forEach((p) => { if (p.id === id) p.essencial = true; })); });

  /* A pergunta aparece se não pertence a módulo, se o módulo está ativo ou se já tem resposta. */
  R.perguntaVisivel = (p, estado) => !p.modulo || !!(estado.modulos && estado.modulos[p.modulo]) ||
    !!(estado.respostas[p.id] && typeof estado.respostas[p.id].texto === 'string' && estado.respostas[p.id].texto.trim());

  /* Departamentos sugeridos para grupos que atuam com contratos públicos. */
  R.DEPARTAMENTOS_PADRAO = [
    ['Licitações', 'Editais, participação, propostas e resultados'],
    ['Contratos', 'Gestão dos contratos com os órgãos contratantes'],
    ['Financeiro', 'Contas, pagamentos, recebimentos e fluxo de caixa'],
    ['Compras', 'Fornecedores, cotações e aquisições'],
    ['Recursos Humanos', 'Funcionários, contratações e alocação de pessoal'],
    ['Operacional', 'Execução dos serviços contratados'],
    ['Administrativo', 'Gestão documental e controles internos'],
    ['Contabilidade e prestação de contas', 'Resultados, documentos e obrigações por empresa e contrato']
  ];

  R.PAPEIS_EMPRESA = [['', 'Selecione'], ['administradora_operacional', 'Administradora com operação própria'], ['administradora', 'Administradora (só gestão)'], ['operacional', 'Operacional']];
  R.ONDE_FUNCIONA = [['', 'Selecione'], ['centralizado', 'Centralizado na administradora'], ['cada_empresa', 'Em cada empresa'], ['misto', 'Misto: parte central, parte em cada empresa']];

  /* Sugestões de nome de departamento (o nome continua livre). */
  R.DEPARTAMENTOS_SUGERIDOS = ['Licitações', 'Contratos', 'Financeiro', 'Compras', 'Recursos Humanos', 'Operacional', 'Administrativo', 'Contabilidade e prestação de contas', 'Comercial', 'Estoque e logística', 'TI'];

  /* Índice de perguntas por id, com a etapa de origem. */
  R.PERGUNTAS = {};
  R.ETAPAS.forEach((e) => (e.perguntas || []).forEach((p) => { R.PERGUNTAS[p.id] = { q: p.q, curto: p.curto, descritiva: !!p.descritiva, essencial: !!p.essencial, modulo: p.modulo || '', etapa: e }; }));
})();
