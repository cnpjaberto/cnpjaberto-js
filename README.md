# cnpjaberto

SDK TypeScript e servidor **Model Context Protocol (MCP)** para o [CNPJ Aberto](https://cnpjaberto.com.br). São **40 ferramentas** de consulta cadastral, prospecção, análise societária, compliance e estatísticas, incluindo recursos PRO.

Requer **Node.js 20+**. ESM.

```bash
npm install cnpjaberto
```

## Configurar o MCP

Adicione ao cliente MCP compatível com stdio:

```json
{
  "mcpServers": {
    "cnpjaberto": {
      "command": "npx",
      "args": ["-y", "--package", "cnpjaberto", "cnpjaberto-mcp"],
      "env": {
        "CNPJABERTO_API_KEY": "sua_chave_aqui"
      }
    }
  }
}
```

Obtenha a chave na sua conta do [CNPJ Aberto](https://cnpjaberto.com.br). As integrações usam `X-API-Key`; a mesma chave libera os recursos permitidos pelo plano da conta. PRO não precisa de outra chave nem de uma opção `pro: true`.

Exemplos de perguntas:

- “Consulte o CNPJ 18.236.120/0001-58 e liste suas filiais em SP.”
- “Encontre o código de São Paulo e busque empresas abertas neste ano com e-mail.”
- “Compare os sócios destas duas empresas.”
- “Monte o dossiê de compliance desta empresa, preservando fontes e ressalvas.”
- “Consulte o catálogo do Panorama e compare relatórios publicados sem MEI.”

`CNPJABERTO_BASE_URL` substitui o endereço base para desenvolvimento. Configure apenas um servidor confiável: ele receberá sua chave. O servidor usa stdout exclusivamente para o protocolo MCP.

## Usar o SDK

```ts
import { Client } from "cnpjaberto";

const client = new Client(); // CNPJABERTO_API_KEY e CNPJABERTO_BASE_URL
const empresa = await client.lookup("18.236.120/0001-58");
console.log(empresa.razao_social, empresa.porte_descricao);
console.log(empresa.estabelecimentos[0]?.email);

const filiais = await client.filiais("18236120000158", {
  uf: "SP",
  q: "Centro",
  page: 1,
  perPage: 200,
});

const municipios = await client.searchMunicipalities("São Paulo", { uf: "SP" });
console.log(municipios); // reutilize codigo exatamente como retornado

const leads = await client.leads({
  uf: "SP",
  municipio_codigo: "7107",
  cnae: "6201501",
  data_abertura_min: "2026-01-01",
  com_email: true,
  per_page: 20,
});
console.log(leads.results); // contatos reais dependem do plano PRO

const dossie = await client.complianceDossier("18236120000158"); // PRO
const catalogo = await client.panoramaCatalog();
console.log(dossie, catalogo);
// Use um período disponível no catálogo, no formato YYYY ou YYYYMM.
const relatorio = await client.panoramaReport("202609", {
  uf: "SP",
  recorte: "nao_mei",
  tema: "tecnologia",
});
```

Os métodos antigos mantêm seus nomes e `perPage`. Os métodos novos usam os nomes de parâmetros da API (`per_page`, `municipio_codigo`, etc.). As ferramentas MCP usam os nomes da tabela abaixo e parâmetros em snake_case; `search_companies` mantém `query`, e as consultas individuais de sócio mantêm `name`.

`Client.execute(nome, argumentos, { signal })` oferece acesso tipado a todas as ferramentas com cancelamento:

```ts
const controller = new AbortController();
const result = await client.execute(
  "advanced_search",
  {
    uf: "SP,RJ",
    nome_empresa: "PADARIA",
    com_telefone: true,
  },
  { signal: controller.signal },
);
```

Opções do construtor: `apiKey`, `baseUrl`, `timeoutMs` (padrão 30.000, inclui leitura da resposta) e `fetchImpl`. Não há retries automáticos nem paginação automática, para evitar consumo inesperado de cota. Arrays, como `cnpjs` em `common_owners`, são enviados como parâmetros repetidos.

## Ferramentas e métodos

“Conta” significa API Key válida de qualquer plano; “PRO” significa acesso PRO exigido pelo backend para integrações.

| Ferramenta MCP              | Método SDK                                               | Acesso / comportamento                                 |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `lookup_cnpj`               | `lookup(cnpj)`                                           | Conta; CNPJ completo de 14 caracteres                  |
| `list_filiais`              | `filiais(cnpj, opts?)`                                   | Conta; `page` e `per_page` até 200, `uf`, `q`          |
| `search_companies`          | `search(q, opts?)`                                       | Conta; mínimo 4 caracteres, 20 itens, 50 páginas       |
| `companies_by_owner`        | `companiesByOwner(name, opts?)`                          | Conta; `cpf`, `exclude`, `limit` até 50                |
| `owner_companies_summary`   | `ownerCompaniesSummary(name, opts?)`                     | Conta; contagem leve                                   |
| `owner_summaries_batch`     | `ownerSummariesBatch(items, opts?)`                      | Conta; POST de consulta, até 10.000 `{ nome, cpf? }`   |
| `companies_at_same_address` | `companiesAtSameAddress(cep, logradouro, numero, opts?)` | PRO; até 100 resultados                                |
| `companies_by_contact`      | `companiesByContact(opts)`                               | PRO; `email` ou `ddd` + `telefone`, `exclude`, até 100 |
| `participations`            | `participations(cnpj, opts?)`                            | PRO; participações como sócio PJ                       |
| `control_tree`              | `controlTree(cnpj)`                                      | PRO; árvore de controle                                |
| `common_owners`             | `commonOwners(cnpjs, opts?)`                             | PRO; 2–50 raízes distintas, `modo`, `min_empresas`     |
| `advanced_search`           | `advancedSearch(opts)`                                   | Conta; contato/endereço exato exigem PRO               |
| `competitors`               | `competitors(cnpj)`                                      | Conta; até 8 concorrentes                              |
| `person_profile`            | `personProfile(nome, opts?)`                             | Conta; prévia gratuita, detalhes PRO                   |
| `search_owners`             | `searchOwners(opts)`                                     | Conta; nome ou CPF, idade e município, até 25 páginas  |
| `autocomplete_owners`       | `autocompleteOwners(q, opts?)`                           | Conta; até 15 sugestões                                |
| `leads`                     | `leads(opts)`                                            | Conta; contatos mascarados sem PRO                     |
| `companies_by_city`         | `companiesByCity(opts)`                                  | PRO; UF + município, nome/rua/bairro                   |
| `corporate_group`           | `corporateGroup(cnpj)`                                   | PRO; mapa do grupo empresarial                         |
| `red_flags`                 | `redFlags(cnpj)`                                         | Conta; indicadores cadastrais                          |
| `ownership_network`         | `ownershipNetwork(q, opts?)`                             | Conta; preserve limites e prévias retornadas           |
| `compliance_summary`        | `complianceSummary(cnpj)`                                | Conta; sanções e dívida da própria empresa             |
| `compliance_dossier`        | `complianceDossier(cnpj)`                                | PRO; dossiê, sócios, PEP e sanções                     |
| `active_debt`               | `activeDebt(cnpj)`                                       | Conta; `encontrado: false` é resposta válida           |
| `cnae_stats`                | `cnaeStats(codigo)`                                      | Conta; CNAE de 7 dígitos, aceita máscara               |
| `list_cnaes`                | `listCnaes()`                                            | Conta; códigos CNAE                                    |
| `cnae_catalog`              | `cnaeCatalog(secao?)`                                    | Conta; códigos/descrições, seção A–U                   |
| `cnae_hub_summary`          | `cnaeHubSummary()`                                       | Conta; contagens por seção                             |
| `search_cnaes`              | `searchCnaes(q, opts?)`                                  | Conta; código ou descrição, até 30                     |
| `search_municipalities`     | `searchMunicipalities(q, opts?)`                         | Conta; nome, UF opcional, até 30                       |
| `municipalities_by_uf`      | `municipalitiesByUf(uf)`                                 | Conta; códigos e nomes                                 |
| `services_catalog`          | `servicesCatalog()`                                      | Conta; slugs de serviços                               |
| `search_services`           | `searchServices(opts)`                                   | Conta; serviço, UF, município, `sem_mei`               |
| `panorama_overview`         | `panoramaOverview(opts?)`                                | Conta; filtro `sem_mei`                                |
| `panorama_year`             | `panoramaYear(year, opts?)`                              | Conta; 2020 ao ano atual, `sem_mei`                    |
| `panorama_alphanumeric`     | `panoramaAlphanumeric(year)`                             | Conta; CNPJs alfanuméricos                             |
| `panorama_catalog`          | `panoramaCatalog(edicao?)`                               | Conta; períodos/edições publicados                     |
| `panorama_report`           | `panoramaReport(periodo, opts?)`                         | Conta; UF, recorte, tema, edição                       |
| `panorama_report_csv`       | `panoramaReportCsv(periodo, opts?)`                      | Conta; CSV como string, `tabela` selecionável          |
| `panorama_revisions`        | `panoramaRevisions(periodo)`                             | Conta; revisões do período                             |

### Filtros e respostas

- CNPJ completo: 12 posições alfanuméricas + 2 dígitos finais; pontuação e caixa são normalizadas sem descartar letras. O SDK valida a forma; a API valida existência e, no lookup, dígitos verificadores. `exclude` usa somente a raiz de 8 caracteres. `commonOwners` também aceita raízes/prefixos.
- `lookup` mantém a estrutura real do backend: `estabelecimentos[]`, `socios[]`, `simples`, porte, capital e totais. Na consulta por CNPJ completo via API Key, o backend seleciona o estabelecimento solicitado. Use `filiais`, `total_filiais` e `filiais_por_uf` para as filiais.
- `advancedSearch`: UF (até 5, separadas por vírgula), CNAE, situação, porte, capital mínimo/máximo, MEI, município e prefixo do nome (mínimo 4). Contato (`com_email`, `com_telefone`, `email`, `telefone`) e endereço (`cep`, `numero`) são PRO; número requer CEP. Exige CNAE, código de município, prefixo de nome, CEP ou contato exato; apenas UF não basta. Filtrar por MEI (true ou false) também exige cidade. O backend pode rejeitar filtros amplos mesmo após validação local.
- `leads`: UF e `municipio_codigo` obrigatórios; CNAE, situação, porte, capital, idade, datas de abertura ISO e presença de contatos. Até 50 páginas de 50 itens. Os códigos de município devem vir das ferramentas de referência; não presuma que outro catálogo usa o mesmo código.
- `companiesByContact` segue o telefone RF legado de 4–8 dígitos com DDD de 2–4. Para números de celular com 9 dígitos, use `advancedSearch({ telefone: ... })`, que suporta a normalização do backend.
- Preserve `total_capped`, `filiais_truncated`, `lista_truncada`, `preview`, `contact_gated`, `avisos` e fontes. `pro@upgrade.com` e telefones mascarados em leads gratuitos são marcadores de acesso, não contatos reais. Documentos parciais não eliminam todos os homônimos.
- Panorama publicado: `periodo` = `YYYY` ou `YYYYMM`; `recorte` = `todos`, `mei`, `nao_mei`, `indeterminado`; `tema` = `beleza`, `alimentacao`, `tecnologia`, `logistica`, `saude`. `edicao` tem 16 caracteres hexadecimais. CSV permite `cnaes`, `municipios`, `ufs`, `idades`, `historico`, `segmentos`, `divisoes`. A disponibilidade de períodos depende do catálogo.

As respostas cadastrais e os modelos estáveis têm interfaces TypeScript exportadas. Endpoints analíticos sem `response_model` no backend retornam `ApiObject` (`Record<string, unknown>`), preservando campos novos sem inventar um contrato rígido. Não há validação estrutural das respostas em runtime. MCP retorna texto e `structuredContent`; arrays e CSV usam `{ result: ... }` no conteúdo estruturado.

### Limites do escopo PRO

Acesso PRO no site e na API não é idêntico. O pacote segue as rotas compatíveis com API Key:

- Exportações assíncronas `/api/exports` e gestão/uso da API Key `/api/auth/api-key/*` exigem JWT de sessão no backend atual; não são ferramentas deste MCP.
- `/api/ai/*` rejeita explicitamente `X-API-Key`; perguntas e grafos da pesquisa com IA continuam no site. As ferramentas societárias acima usam as rotas de dados compatíveis.
- Login, cobrança, administração e mutações da conta não são expostos.

O CSV de **Panorama publicado** é uma rota de consulta compatível e está disponível, independentemente das exportações assíncronas de prospecção.

## Erros e cotas

```ts
import {
  Client,
  AuthError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "cnpjaberto";

try {
  await new Client().complianceDossier("18236120000158");
} catch (error) {
  if (error instanceof ForbiddenError)
    console.error("Acesso PRO necessário", error.payload);
  else if (error instanceof AuthError) console.error("Verifique a chave");
  else if (error instanceof RateLimitError)
    console.error(error.retryAfter, error.payload);
  else if (error instanceof ValidationError) console.error(error.message);
  else throw error;
}
```

Todos os erros próprios herdam de `CnpjAbertoError`, com `status`, `payload` e `retryAfter` quando disponíveis. `ForbiddenError` (403) também herda de `AuthError` para compatibilidade. Há ainda `NotFoundError`, `TimeoutError` e `TransportError`. O MCP retorna falhas com `isError: true`, preserva detalhes de acesso/cota e remove a chave configurada de mensagens refletidas pelo servidor.

Cotas são decididas pelo servidor, não codificadas no SDK. Respostas 429 e `Retry-After` orientam a retomada; um retry também pode consumir cota. Redirecionamentos HTTP são rejeitados para não encaminhar a chave a outro destino.

## Desenvolvimento e validação

```bash
npm ci
npm test
npm pack --dry-run
# Opcional: usa sua chave e consome cota real
CNPJABERTO_API_KEY=... npm run test:smoke
```

A suíte offline cobre contratos HTTP de todos os métodos, validação, alfanuméricos, filtros PRO, POST de lote, arrays na query, erros, timeouts/cancelamento, catálogo e chamadas MCP em memória, além do handshake real do executável stdio. Não exige chave nem consulta produção.

Para restringir as ferramentas de um servidor embutido:

```ts
import { buildServer } from "cnpjaberto/mcp";
const server = buildServer({ tools: ["lookup_cnpj", "search_companies"] });
// Conecte server ao transporte MCP desejado.
```

## Migração de 0.1

Os nove métodos/ferramentas originais permanecem, com validação atualizada. Mudanças que podem exigir ajuste: Node 20+, lookup exige CNPJ completo, busca exige 4 caracteres, ano do Panorama não é mais truncado e deve estar entre 2020 e o ano atual. Filiais agora permitem 200 itens e filtro `q`; contato MCP agora aceita `exclude`. Respostas deixam de ser `any`: trate campos analíticos `unknown` antes de usá-los.

Contratos auditados no checkout `cnpj`, commit `50b17005c81d4c81f2faebd8f322dc5e93d66405`, em 2026-10-04. Rotas, schemas, serviços e autenticação do backend prevalecem sobre exemplos desatualizados da documentação do site.

## Fonte e licença

Dados cadastrais da base pública da Receita Federal; compliance e relatórios incluem suas próprias fontes e datas. A versão da base não implica atualização em tempo real. MIT para este pacote; preserve a atribuição/licença informada nos dados exportados.
