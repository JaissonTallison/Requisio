# Requisio

Ferramenta de levantamento de requisitos e mapeamento de processos para usar em visitas a futuros clientes. Ela transforma a entrevista em um relatório de diagnóstico e proposta de solução, organizado por departamento e independente de produto. Funciona só no navegador, sem servidor e sem banco de dados remoto.

## Como usar

1. Abra o arquivo `index.html` no navegador (Chrome ou Edge recomendados). Não precisa instalar nada.
2. Preencha as etapas: Cadastro, Empresa, Estrutura organizacional, Departamentos, Processos, Problemas, Sistemas atuais, Requisitos e Solução desejada.
3. Em **Solução desejada**, clique em **Finalizar e gerar relatório**.
4. Revise e edite o relatório, registre a decisão do cliente sobre cada solução e use **Imprimir ou salvar PDF**.

## Entrevista

- **Salvamento automático:** cada alteração é gravada no aparelho cerca de 0,15 s depois da digitação, ao sair de um campo, ao trocar de etapa e ao fechar, minimizar ou atualizar a página. A etapa aberta também é restaurada.
- **Módulos de perguntas:** no Cadastro, ative conforme o cliente:
  - Grupo com várias empresas;
  - Equipes com vínculos variados;
  - Licitações e contratos públicos;
  - Prestação de contas e contabilidade;
  - Operação em várias áreas de serviço.

  Cada módulo acrescenta perguntas, com exemplos, nas etapas correspondentes. Num cliente simples, basta não ativar nada.
- **Grupo de empresas:** com o módulo de grupo ativo, o Cadastro lista as empresas e o papel de cada uma (administradora com operação própria, só administradora ou operacional). Cada departamento ganha o campo **Onde funciona no grupo** (centralizado na administradora, em cada empresa ou misto). O botão **Adicionar departamentos sugeridos** cria Licitações, Contratos, Financeiro, Compras, Recursos Humanos, Operacional, Administrativo e Contabilidade e prestação de contas.
- **Conferência antes de sair da visita:** no topo da etapa Solução desejada, lista em tempo real o que falta. Cada item tem o botão **Ir**, que leva direto à pergunta.
  - Perguntas essenciais sem resposta e respostas vagas.
  - Empresas sem papel ou CNPJ.
  - Departamentos sem responsável, sem atividades, sem definição de onde funcionam ou sem processo mapeado.
  - Volumes divergentes e respostas marcadas para confirmar.
- **Exemplos de resposta:** abaixo de cada pergunta, em cinza claro, há exemplos para o entrevistador orientar quem não sabe responder. Tocar num exemplo insere o texto no campo, onde pode ser editado; nada é preenchido sem esse toque.
- **Voltar sem perder nada:** os botões Anterior e Próxima, o gesto de voltar do celular e o botão Voltar do navegador trocam de etapa dentro do Requisio; nada do que foi preenchido é apagado.
- **Fotos e documentos:** cada etapa tem **Tirar foto** (abre a câmera no celular e no tablet) e **Anexar arquivo** (planilhas, PDFs, imagens, documentos), com descrição. Fotos grandes são reduzidas para até 1600 px. Limite de 30 MB por arquivo. As descrições entram na análise, e os anexos aparecem no anexo técnico do relatório.
- **Progresso:** o menu lateral mostra respostas preenchidas por etapa e o total da entrevista. Dá para voltar a qualquer etapa.
- **Pendente: confirmar depois:** marque só as respostas que ainda precisam ser confirmadas com o cliente. Elas aparecem como “Pendente de confirmação” no relatório. Respostas sem marcação são tratadas como informadas pelo cliente.
- **Departamentos e processos:** o nome do departamento é livre, com sugestões (Financeiro, RH, Compras, Administrativo, Comercial, Operacional e outros). Cada processo tem departamento responsável e outros departamentos envolvidos, o que identifica processos entre áreas.
- **Voz:** o botão **Gravar** de cada resposta usa o reconhecimento de voz nativo do navegador (Web Speech API, em pt-BR). Na primeira gravação, o Requisio pede a confirmação de que o entrevistado autorizou. O texto transcrito entra no campo e pode ser editado. Se o navegador não oferecer o recurso, o aviso aparece na etapa e o botão fica desativado.

## Onde os dados ficam e como são protegidos

- **Levantamentos salvos:** o botão **Levantamentos** lista todos os levantamentos guardados no aparelho, com relatório e anexos, para abrir, exportar ou excluir. **Novo levantamento** não apaga o anterior. **Excluir** (ícone de lixeira) vale para qualquer levantamento, inclusive o aberto, e move para a **Lixeira**, de onde dá para restaurar ou excluir definitivamente; itens com mais de 30 dias na lixeira são apagados.
- **Três cópias no aparelho:**
  - **LocalStorage:** cópia rápida do levantamento aberto.
  - **IndexedDB:** todos os levantamentos e arquivos, com gravação confirmada no disco, o que protege contra bateria descarregada ou aparelho travado.
  - **Versão anterior:** guardada a cada minuto.
  Ao abrir, o Requisio usa a cópia válida mais recente e avisa quando houve recuperação.
- **Abas e aparelho em segundo plano:** abas abertas ao mesmo tempo se mantêm sincronizadas. Uma aba antiga reaberta carrega os dados mais recentes antes de gravar, e a versão dela fica guardada à parte.
- **Sem internet:** publicado em `https`, o Requisio funciona offline depois da primeira visita (service worker em `sw.js`). O preenchimento continua salvo no aparelho; só a gravação por voz precisa de internet. Quando há conexão, a versão mais nova do sistema é sempre carregada.
- **Persistência:** o Requisio pede ao navegador que não apague os dados quando faltar espaço (quando o navegador permite).

## Motor de análise (`js/analise.js`)

A análise é feita por regras, no próprio navegador:

- **Classifica cada resposta:** informativa, negativa (“Não”, “Nenhum”), vaga (“Sim”, “Administrativo”, “Prazos, cálculos” em pergunta que pede descrição), desconhecida (“Não sei”) ou sem resposta. Respostas negativas, vagas e desconhecidas não geram recomendação; viram pendência.
- **Identifica os departamentos:** os cadastrados, os citados na estrutura organizacional e os citados nas respostas. Cada frase é associada ao departamento citado pelo nome ou, se nenhum for citado, pelo assunto (“pagamento via PIX” → Financeiro). A fonte do item indica quando a associação foi pelo assunto.
- **Reconhece padrões de problema pelo contexto**, não por palavra solta: “pagamento” só vira o padrão de pagamentos manuais quando aparece junto de execução manual (“um por um”, “pelo app do banco”); termos negados (“não usamos planilha”) são ignorados. Cada padrão traz causa, impacto, objetivo, processo futuro, funcionalidades, atores, critérios de aceitação, riscos e perguntas a esclarecer.
- **Extrai volumes e aponta divergências**, por exemplo “100 pix” num campo e “500 pessoas por semana” em outro.
- **Padrões para contratos públicos:** gestão de licitações, contratos públicos (vigência, medições, recebimentos, resultado por contrato), pessoal com vínculos variados e diárias, e prestação de contas por empresa e por contrato.
- **Detecta operação com várias empresas, o aprovador** (por exemplo, “o CEO é a palavra final”) **e prazo curto** para o escopo.

Para incluir um novo padrão, acrescente um item em `PADROES` (em `js/analise.js`).

## Relatório (`js/relatorio.js`)

1. Resumo executivo
2. Diagnóstico geral
3. Diagnóstico por departamento: situação atual, responsáveis, processos AS-IS, problemas com causa e impacto e prioridade
4. Processos atuais e futuros (AS-IS e TO-BE)
5. Soluções propostas por departamento: problema, objetivo, processo futuro, módulos e funcionalidades (com tipo de entrega: configuração de sistema existente, customização, integração ou desenvolvimento novo), atores e permissões, regras de negócio, integrações, critérios de aceitação, dependências e riscos, e validação
6. Diagramas: fluxo AS-IS (só quando o passo a passo foi informado), fluxo TO-BE com raias, casos de uso, classes conceituais e sequência quando há integração
7. Requisitos e regras de negócio
8. Arquitetura sugerida, com diagrama
9. Etapas de desenvolvimento, em sequência
10. Riscos, dependências e pendências, agrupadas por etapa
11. Estimativa preliminar, apresentada só com dados suficientes; caso contrário, lista o que falta
12. Próximos passos e aprovação do cliente, com a situação de cada solução e espaço para assinatura

Com várias empresas, o diagnóstico geral mostra a **estrutura do grupo**, com diagrama, e a matriz **departamentos × empresas**. As soluções incluem a **Estrutura multiempresa**, base comum a todas: dados separados por empresa, administradora com a visão do grupo separada da operação própria, consolidação, perfis por empresa e transações entre empresas. Ela tem validação própria.

As respostas originais ficam no **anexo técnico**, sem repetir o questionário no corpo do relatório.

**Origem de cada item:** *Informado pelo cliente*, *Pendente de confirmação*, *Inferência do sistema* ou *Recomendação técnica*. Requisitos, regras e funcionalidades começam como “A validar”. Só valem como aprovados os itens marcados como “Aprovado” e as soluções com decisão “Aprovada”.

**Validação:** cada solução de departamento pode ser aprovada, rejeitada ou receber pedido de alterações, com comentário. Nada é aprovado de forma automática. Ao gerar o relatório de novo, as decisões ficam registradas, mas aparecem como referentes à versão anterior até serem confirmadas.

**Diagramas:** usam Mermaid e podem ser editados em “Editar código do diagrama”. A biblioteca (`lib/mermaid/mermaid.min.js`, versão 11.12.3, licença MIT) fica no projeto para funcionar sem internet e só é carregada ao abrir o relatório.

**Exportar e importar JSON:** guarda ou transfere o levantamento completo, inclusive o relatório editado, as decisões e os arquivos anexados. Importar acrescenta o levantamento à lista sem apagar os outros; se ele já existir, dá para substituir o salvo ou importar como cópia. Arquivos do formato anterior continuam abrindo e podem ser gerados de novo no formato atual.

## Levantamentos preparados antes da visita

Arquivos JSON de clientes ficam em `levantamentos/`, que o git ignora (não vão para o repositório nem para o site). Para usar no celular ou tablet, envie o arquivo para o aparelho e use **Importar JSON**. O que foi informado antes da visita entra marcado como **Pendente: confirmar depois**; na visita, confirme ou corrija e desmarque.

## Arquivos

```
index.html               estrutura da página
sw.js                    funcionamento sem internet (service worker)
css/estilos.css          visual, responsivo e impressão
js/armazenamento.js      estado, validação dos dados, LocalStorage, IndexedDB e arquivos
js/etapas.js             etapas, perguntas e campos
js/voz.js                gravação e transcrição
js/analise.js            motor de análise
js/diagramas.js          construção e desenho dos diagramas Mermaid
js/relatorio.js          montagem do relatório
js/app.js                interface, navegação, salvamento, importação e exportação
lib/mermaid/             biblioteca de diagramas (MIT)
```

## Limitações conhecidas

- **A análise é por regras, não por inteligência artificial.** Ela reconhece os padrões cadastrados (pagamentos manuais, planilhas, mensagens, informação descentralizada, fluxo de caixa, contratação), negações, respostas vagas e volumes. Problemas fora desses padrões aparecem como fatos informados pelo cliente, sem solução proposta, e precisam ser tratados manualmente.
- **Voz depende do navegador.** Chrome e Edge enviam o áudio ao serviço de reconhecimento do fornecedor, então é preciso internet. O Firefox não oferece o recurso. No Safari, o funcionamento varia por versão.
- **Os dados ficam no aparelho e no navegador em que foram preenchidos.** Não há sincronização entre celular, tablet e computador (isso exigiria servidor). Para levar um levantamento de um aparelho para outro, use Exportar e Importar JSON.
- **Limpar os dados de navegação apaga os levantamentos.** No Safari (iPhone e iPad), o próprio navegador pode apagar dados de sites não visitados há mais de 7 dias; adicionar o Requisio à Tela de Início evita isso. Exporte o JSON ao final de cada visita como cópia externa.
- **Arquivos anexados aumentam o JSON exportado** (vão embutidos no arquivo).
- **Gerar novamente o relatório** substitui as edições feitas nele (o sistema avisa antes).
- **Diagramas grandes** podem ocupar uma página inteira no PDF.
