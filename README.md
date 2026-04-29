# cnpjaberto

SDK em TypeScript e servidor **Model Context Protocol (MCP)** para o [cnpjaberto.com.br](https://cnpjaberto.com.br), o cadastro aberto de empresas brasileiras (CNPJ). Permite consulta de empresa, grafo de sócios, joins por endereço e contato, estatísticas por CNAE, e panoramas nacional e anual.

```bash
npm install cnpjaberto
```

## Servidor MCP (Claude Desktop, Cursor, Cline)

Adicione no config do seu cliente MCP. O `npx -y cnpjaberto` baixa o pacote sob demanda, sem precisar instalar globalmente.

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "cnpjaberto": {
      "command": "npx",
      "args": ["-y", "cnpjaberto"],
      "env": { "CNPJABERTO_API_KEY": "sua_chave_aqui" }
    }
  }
}
```

Reinicie o Claude Desktop e pergunte:

* *"Consulta o CNPJ 18.236.120/0001-58 e me diz quando foi fundado."*
* *"Quantas empresas brasileiras abriram em 2024 vs 2023?"*
* *"Acha empresas onde 'Maria Silva' aparece como sócia."*

A chave de API é obrigatória e gratuita. Crie em cnpjaberto.com.br/planos.

## SDK

```ts
import { Client } from "cnpjaberto";

const cnpj = new Client();                           // lê CNPJABERTO_API_KEY do ambiente

const empresa = await cnpj.lookup("18.236.120/0001-58");
console.log(empresa.razao_social);

const snap = await cnpj.panoramaYear(2024);
console.log(`${snap.abertas} abertas em 2024`);
```

## Tools expostas

| Tool | O que retorna |
|---|---|
| `lookup_cnpj(cnpj)` | Registro completo: razão social, capital, sócios, com `estabelecimentos[]` (matriz e filiais, endereço, telefones, CNAEs) |
| `list_filiais(cnpj)` | Filiais de uma matriz, paginado, filtro opcional por UF |
| `search_companies(query)` | Busca por razão social, fantasia ou dígitos do CNPJ |
| `companies_by_owner(name)` | Empresas onde a pessoa aparece como sócia; `cpf` ajuda a desambiguar homônimos |
| `companies_at_same_address(cep, logradouro, numero)` | Outras empresas registradas no mesmo endereço |
| `companies_by_contact(email \| ddd+telefone)` | Empresas que compartilham o mesmo email ou telefone |
| `cnae_stats(codigo)` | Estatísticas agregadas de um CNAE |
| `panorama_overview()` | Estatísticas nacionais |
| `panorama_year(year)` | Recorte anual |

## Erros tipados

```ts
import { Client, NotFoundError, RateLimitError, AuthError } from "cnpjaberto";

const cnpj = new Client();
try {
  await cnpj.lookup("00000000000000");
} catch (e) {
  if (e instanceof NotFoundError) { /* ... */ }
  if (e instanceof RateLimitError) console.log("cota:", e.payload);
  if (e instanceof AuthError) { /* ... */ }
}
```

## Fonte de dados

Todos os dados vêm do dump público de CNPJ da Receita Federal, atualizado mensalmente.

## Licença

MIT.
