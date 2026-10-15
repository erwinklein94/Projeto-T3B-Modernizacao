# Projeto T3B · Modernização

Leitor local de planilhas de controle de dormentes. O site tem apenas Dashboard e Registros, sem login, contas, perfis ou conexão com banco de dados.

## Usar

1. Abra **Registros → Importar planilha Excel**.
2. Selecione a planilha `.xlsx` mais atualizada, com as abas e colunas no padrão original.
3. Consulte os registros, os filtros e os indicadores do Dashboard.

A importação substitui integralmente a base anterior. Não acrescenta linhas nem combina arquivos. Para atualizar um registro, altere o Excel, salve e importe novamente.

Os dados são processados no dispositivo e persistidos somente no `localStorage` deste site, neste navegador. Recarregar a página mantém a última importação. Outro dispositivo, navegador ou perfil começa vazio. Abas abertas no mesmo navegador acompanham a substituição ou limpeza dos dados. O arquivo Excel não é enviado a nenhum servidor.

Sem importação, o site exibe somente a estrutura e os estados vazios. **Limpar dados locais** remove a base importada; limpar o armazenamento do navegador tem o mesmo efeito. Não há cópia de segurança ou sincronização remota. Falhas de leitura, validação ou gravação preservam a base anterior.

## Padrão da planilha

Abas obrigatórias: `Parametros`, `Recebimentos`, `Movimentacoes`, `Danificados`, `Devolucoes_Danificados`, `Conciliacao`, `Consumo_Final` e `Transferencias`.

Abas opcionais: `Danif.`, `Recebimento Semanal` e `Propriedades da Madeira`. Abas adicionais, como Dashboard e Gráficos do Excel, são ignoradas. As colunas operacionais devem manter nomes e ordem. A aba `Danif.` aceita novas colunas de datas de apuração. Uma importação sem uma aba opcional remove seus dados da base anterior.

- Cabeçalhos são identificados nas primeiras dez linhas, preservando os títulos e espaços de apresentação do modelo.
- Linhas vazias, linhas contendo apenas fórmulas e linhas de recebimento contendo apenas localização pré-preenchida são ignoradas.
- Datas do Excel são convertidas sem mudança de dia por fuso horário. Datas em texto não interpretáveis e quantidades fracionadas são preservadas.
- Fórmulas usam os resultados armazenados no arquivo; o leitor não é um motor de cálculo do Excel. Recalcule e salve o arquivo no Excel antes de importar. Erros de células e fórmulas de quantidade/volume sem valor salvo geram avisos. Valores ausentes ou erros não são somados como números.
- O saldo é calculado exclusivamente pelas entradas e saídas em Movimentacoes. Recebimentos, consumo, transferências e resumos não geram movimentações adicionais.
- Filtros de período excluem datas não interpretáveis. Saldo do período significa entradas menos saídas no intervalo. Sem data inicial, o saldo inclui todo o histórico importado.
- Associação de fornecedor nas movimentações usa pátio, lote e espécie. Lotes ambíguos não são atribuídos automaticamente.
- Apurações e resumos semanais são referências independentes e não são somados aos indicadores.

Exportações de consulta para Excel e PDF, detalhes dos gráficos, apresentação e temas continuam disponíveis.

## Desenvolvimento e publicação

Node.js 24 e pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

Os testes de navegador precisam do Chromium do Playwright (`pnpm exec playwright install chromium`) ou de `PLAYWRIGHT_CHANNEL=chrome` para usar o Chrome instalado. Usam planilhas sintéticas e o build de produção, sem dados privados.

O workflow publica somente `dist` no GitHub Pages quando `main` recebe alterações. Configure Pages para **GitHub Actions**. Base: `/Projeto-T3B-Modernizacao/`. Não são necessárias variáveis de ambiente, chaves ou serviços externos de dados. O servidor de desenvolvimento também começa vazio e não fornece histórico privado.

Planilhas reais, dados históricos e arquivos privados ficam fora do Git e do build. A antiga integração com Supabase foi removida do código; esta migração não executa alterações no serviço remoto.
