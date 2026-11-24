# Requisio

Ferramenta de levantamento de requisitos e mapeamento de processos para usar em visitas a futuros clientes. Ela transforma a entrevista em um relatório de diagnóstico e proposta de solução, organizado por departamento e independente de produto. Funciona só no navegador, sem servidor e sem banco de dados remoto.

## Como usar

1. Abra o arquivo `index.html` no navegador (Chrome ou Edge recomendados). Não precisa instalar nada.
2. Preencha as etapas: Cadastro, Empresa, Estrutura organizacional, Departamentos, Processos, Problemas, Sistemas atuais, Requisitos e Solução desejada.
3. Em **Solução desejada**, clique em **Finalizar e gerar relatório**.
4. Revise e edite o relatório, registre a decisão do cliente sobre cada solução e use **Imprimir ou salvar PDF**.

## Entrevista

- **Salvamento automático:** cada alteração é gravada no LocalStorage do navegador, cerca de 0,3 s depois da digitação e também ao fechar ou atualizar a página. A etapa aberta também é restaurada.
- **Progresso:** o menu lateral mostra respostas preenchidas por etapa e o total da entrevista. Dá para voltar a qualquer etapa.
- **Pendente: confirmar depois:** marque só as respostas que ainda precisam ser confirmadas com o cliente. Elas aparecem como “Pendente de confirmação” no relatório. Respostas sem marcação são tratadas como informadas pelo cliente.
- **Departamentos e processos:** o nome do departamento é livre, com sugestões (Financeiro, RH, Compras, Administrativo, Comercial, Operacional e outros). Cada processo tem departamento responsável e outros departamentos envolvidos, o que identifica processos entre áreas.
- **Voz:** o botão **Gravar** de cada resposta usa o reconhecimento de voz nativo do navegador (Web Speech API, em pt-BR). Na primeira gravação, o Requisio pede a confirmação de que o entrevistado autorizou. O texto transcrito entra no campo e pode ser editado. Se o navegador não oferecer o recurso, o aviso aparece na etapa e o botão fica desativado.

## Motor de análise (`js/analise.js`)

A análise é feita por regras, no próprio navegador:

- **Classifica cada resposta:** informativa, negativa (“Não”, “Nenhum”), vaga (“Sim”, “Administrativo”, “Prazos, cálculos” em pergunta que pede descrição), desconhecida (“Não sei”) ou sem resposta. Respostas negativas, vagas e desconhecidas não geram recomendação; viram pendência.
- **Identifica os departamentos:** os cadastrados, os citados na estrutura organizacional e os citados nas respostas. Cada frase é associada ao departamento citado pelo nome ou, se nenhum for citado, pelo assunto (“pagamento via PIX” → Financeiro). A fonte do item indica quando a associação foi pelo assunto.
- **Reconhece padrões de problema pelo contexto**, não por palavra solta: “pagamento” só vira o padrão de pagamentos manuais quando aparece junto de execução manual (“um por um”, “pelo app do banco”); termos negados (“não usamos planilha”) são ignorados. Cada padrão traz causa, impacto, objetivo, processo futuro, funcionalidades, atores, critérios de aceitação, riscos e perguntas a esclarecer.
- **Extrai volumes e aponta divergências**, por exemplo “100 pix” num campo e “500 pessoas por semana” em outro.
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

As respostas originais ficam no **anexo técnico**, sem repetir o questionário no corpo do relatório.

**Origem de cada item:** *Informado pelo cliente*, *Pendente de confirmação*, *Inferência do sistema* ou *Recomendação técnica*. Requisitos, regras e funcionalidades começam como “A validar”. Só valem como aprovados os itens marcados como “Aprovado” e as soluções com decisão “Aprovada”.

**Validação:** cada solução de departamento pode ser aprovada, rejeitada ou receber pedido de alterações, com comentário. Nada é aprovado de forma automática. Ao gerar o relatório de novo, as decisões ficam registradas, mas aparecem como referentes à versão anterior até serem confirmadas.

**Diagramas:** usam Mermaid e podem ser editados em “Editar código do diagrama”. A biblioteca (`lib/mermaid/mermaid.min.js`, versão 11.12.3, licença MIT) fica no projeto para funcionar sem internet e só é carregada ao abrir o relatório.

**Exportar e importar JSON:** guarda ou transfere o levantamento completo, inclusive o relatório editado e as decisões. Importar substitui o levantamento aberto (pede confirmação). Arquivos do formato anterior continuam abrindo e podem ser gerados de novo no formato atual.

## Arquivos

```
index.html               estrutura da página
css/estilos.css          visual, responsivo e impressão
js/armazenamento.js      estado, validação dos dados e LocalStorage
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
- **Dados ficam só neste navegador e neste computador.** Limpar os dados de navegação apaga o levantamento. Exporte o JSON ao final de cada visita.
- **Um levantamento por vez.** Para atender outro cliente, exporte o atual e use “Novo levantamento”. Uma cópia de segurança do levantamento anterior fica guardada no navegador (`requisio.backup`) até a próxima troca.
- **Duas abas abertas ao mesmo tempo** gravam por cima uma da outra. Use uma aba só.
- **Gerar novamente o relatório** substitui as edições feitas nele (o sistema avisa antes).
- **Diagramas grandes** podem ocupar uma página inteira no PDF.
