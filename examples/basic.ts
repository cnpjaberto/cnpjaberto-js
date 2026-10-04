/** TypeScript example; run the JavaScript equivalent with npm run test:smoke. */
import { Client } from "../src/index.js";

const client = new Client();
const company = await client.lookup("18236120000158");
console.log(
  company.razao_social,
  company.estabelecimentos[0]?.situacao_cadastral,
);
const results = await client.search("padaria", { perPage: 5 });
for (const hit of results.results) console.log(hit.cnpj, hit.razao_social);
console.log(await client.panoramaCatalog());
