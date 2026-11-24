# Requisio

Ferramenta de levantamento de requisitos e mapeamento de processos para usar em visitas a futuros clientes. Ela transforma a entrevista em um diagnóstico empresarial estruturado e independente de produto. Funciona só no navegador, sem servidor e sem banco de dados remoto.

## Como usar

1. Abra o arquivo `index.html` no navegador (Chrome ou Edge recomendados). Não precisa instalar nada.
2. Preencha as etapas: Cadastro, Empresa, Estrutura organizacional, Departamentos, Processos, Problemas, Sistemas atuais, Requisitos e Solução desejada.
3. Em **Solução desejada**, clique em **Finalizar e gerar diagnóstico**.
4. Revise e edite o diagnóstico. Use **Imprimir ou salvar PDF** e, na janela de impressão, escolha “Salvar como PDF”.

## Funcionamento

- **Salvamento automático:** cada alteração é gravada no LocalStorage do navegador, cerca de 0,3 s depois da digitação e também ao fechar ou atualizar a página. A etapa aberta também é restaurada.
- **Progresso:** o menu lateral mostra respostas preenchidas por etapa e o total da entrevista. Dá para voltar a qualquer etapa.
- **Confirmar com o cliente:** marque nas respostas que precisam ser confirmadas. Elas aparecem como “Pendente de confirmação” no diagnóstico.
- **Voz:** o botão **Gravar** de cada resposta usa o reconhecimento de voz nativo do navegador (Web Speech API, em pt-BR). Na primeira gravação, o Requisio pede a confirmação de que o entrevistado autorizou. O texto transcrito entra no campo e pode ser editado. Se o navegador não oferecer o recurso, o aviso aparece na etapa e o botão fica desativado.
- **Diagnóstico:** cada item indica a origem:
  - *Informado pelo cliente*: texto da resposta, sem acréscimos.
  - *Sugestão do sistema*: oportunidades, fluxos TO-BE, abordagens de solução e plano, sempre com o trecho da resposta que motivou a sugestão.
  - *Pendente de confirmação*: informação ausente ou marcada para confirmar.

  Requisitos e regras de negócio começam como “A validar”. Oportunidades nunca entram na lista de requisitos de forma automática. A proposta não presume um produto nem que toda necessidade exige sistema: pode indicar revisão de processo, automação, integração, modernização, sistema web ou mobile, ERP/módulos de gestão ou software personalizado.
- **Exportar e importar JSON:** guarda ou transfere o levantamento completo, inclusive o diagnóstico editado. Importar substitui o levantamento aberto (pede confirmação).

## Arquivos

```
index.html            estrutura da página
css/estilos.css       visual, responsivo e impressão
js/armazenamento.js   estado, validação e LocalStorage
js/etapas.js          etapas e perguntas
js/voz.js             gravação e transcrição
js/diagnostico.js     geração do diagnóstico
js/app.js             interface, navegação, salvamento, importação e exportação
```

## Limitações conhecidas

- **Voz depende do navegador.** Chrome e Edge enviam o áudio ao serviço de reconhecimento do fornecedor, então é preciso internet. O Firefox não oferece o recurso. No Safari, o funcionamento varia por versão. A precisão depende do microfone e do ruído ambiente, e a pontuação não é automática.
- **Dados ficam só neste navegador e neste computador.** Limpar os dados de navegação apaga o levantamento. Exporte o JSON ao final de cada visita.
- **Um levantamento por vez.** Para atender outro cliente, exporte o atual e use “Novo levantamento”. Uma cópia de segurança do levantamento anterior fica guardada no navegador (`requisio.backup`) até a próxima troca.
- **Duas abas abertas ao mesmo tempo** gravam por cima uma da outra. Use uma aba só.
- **Sugestões automáticas usam termos encontrados nas respostas** (planilha, papel, WhatsApp, retrabalho, aprovação etc.). Uma frase negativa, como “não usamos planilha”, também gera sugestão. Por isso toda sugestão mostra o trecho de origem e precisa de validação.
- **Gerar novamente o diagnóstico** substitui as edições feitas nele (o sistema avisa antes).
