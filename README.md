# Projeto T3B · Modernização

Portal de gestão de dormentes para GitHub Pages e Supabase, em português.

## Executar

Node.js 24 e pnpm 11.25.0. Instale com `pnpm install --frozen-lockfile`, configure `.env.local` com a chave **publicável** conforme `.env.example` e execute `pnpm dev`. Testes: `pnpm test`. Produção: `pnpm build`.

O workflow publica `dist` no GitHub Pages quando a branch `main` recebe alterações. Configure Pages para **GitHub Actions** e a variável de repositório `VITE_SUPABASE_PUBLISHABLE_KEY`. A URL base é `/Projeto-T3B-Modernizacao/`.

## Banco e contas

Projeto autorizado: `ixzvvyslbsuwnyhrxqwf`. Aplique `supabase/schema.sql` uma única vez em banco sem as tabelas T3B. As tabelas têm RLS e o esquema privado concentra funções com privilégios mínimos. Publique a função `supabase/functions/t3b-create-user/index.ts`, que valida a sessão e consulta o perfil Editor antes de chamar a API administrativa. A verificação JWT do gateway está ativa. A função também valida a sessão e a autorização do perfil Editor.

Extraia o ZIP em `.private/source` e execute `scripts/extract_history.py` com Python e openpyxl. A extração não altera os arquivos originais. Ela gera os registros, o arquivo de reconciliação e uma cópia dos valores e fórmulas de todas as abas. `.private` fica fora do Git e da publicação.

Para importar e provisionar, execute `node scripts/provision.mjs` com `SUPABASE_SERVICE_ROLE_KEY` e `T3B_INITIAL_PASSWORD` no ambiente. O script cria as três contas solicitadas, usa chaves de origem para evitar duplicação e confere contagens. Contas já existentes têm suas senhas preservadas. Nunca coloque a chave administrativa ou senhas no frontend, no repositório ou nas variáveis `VITE_*`.

## Perfis

| Perfil | Dashboard | Registros | Criar contas | Auditoria |
|---|---|---|---|---|
| Editor | Sim | Gerencia | Sim | Sim |
| Coordenador | Sim | Gerencia | Não | Não |
| Analista | Sim | Gerencia | Não | Não |
| Consulta | Sim | Não | Não | Não |

Consulta recebe apenas campos necessários aos gráficos via RPC protegida. Documentos fiscais, placas, responsáveis e observações não são expostos nesse retorno. Usuários sem perfil não recebem acesso. Perfis são provisionados por `app_metadata` administrativo, nunca por metadados editáveis pelo usuário.

Logins são auditados por trigger de sessão. Criação, alteração e exclusão lógica de registros são auditadas por triggers, incluindo estado anterior e posterior. Navegação, apresentação, exportações e saída são eventos da aplicação. Como qualquer evento de interface, eles não provam que uma pessoa leu uma página e podem ser omitidos por clientes modificados. Eventos do Editor são excluídos da auditoria, conforme solicitado.

## Histórico e cálculos

- Todas as abas operacionais preenchidas foram preservadas; as contagens e os totais de conferência estão em `.private/reconciliation.json`.
- 56 linhas com apenas localização física pré-preenchida foram excluídas dos registros operacionais; permanecem no arquivo de origem.
- As abas vazias de consumo, transferência e devolução continuam disponíveis para cadastro.
- Datas em texto e horários `00:00:00` são preservados. Filtros de período excluem datas não interpretáveis. Frações de unidades são mantidas.
- O histórico de movimentações é a fonte do saldo. Recebimentos e resumos semanais não são somados a ele. Um novo recebimento cadastrado no site gera uma única movimentação vinculada. Alterar ou excluir esse recebimento atualiza a movimentação. Movimentações históricas são preservadas independentemente dos recebimentos históricos.
- Saídas, transferências, consumo e devoluções devem ter o efeito no estoque registrado em Movimentações. Não são lançadas automaticamente por essas abas, evitando duplicidade e interpretações indevidas.
- O saldo do período é entradas menos saídas no intervalo, não o estoque inicial mais o movimento. Para estoque acumulado, mantenha a data inicial vazia.
- Associação de fornecedor nas movimentações usa pátio, lote e espécie. Lotes ambíguos não são atribuídos automaticamente.
- Resumos semanais e apurações são fotografias independentes. Não recebem filtros de data, espécie ou pátio e não são somados aos indicadores. As imagens do anexo referem-se a um recorte anterior ao final da planilha.

## Exportações e apresentação

Excel: `.xlsx` com as colunas na ordem da aba original, datas numéricas e valores preservados. Cabeçalhos na primeira linha; copie as linhas seguintes para a tabela da planilha original. Não há coluna interna de banco na exportação. Filtros são aplicados antes da exportação, sem limite da paginação de tela.

PDF: resumo e gráficos do dashboard, com filtros e horário de emissão. Tema claro é o padrão a cada abertura; o tema escuro é temporário. O botão Apresentar usa a API de tela cheia.

Identidade: cores do [brandbook Rumo](https://brandbook.rumolog.com/paleta.html), com Verdana como fonte de sistema indicada pelo guia. O texto de marca é uma representação tipográfica; substitua por um ativo oficial se necessário.

## Prévia local

Somente no servidor de desenvolvimento, `?preview=1` carrega `.private/history.json` em modo de leitura. Esse caminho não existe no build de produção. Não exponha o servidor de desenvolvimento publicamente.
