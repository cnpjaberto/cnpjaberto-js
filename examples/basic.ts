/**
 * Exemplo de uso do SDK.
 *
 * export CNPJABERTO_API_KEY=sua_chave_aqui
 * npx tsx examples/basic.ts
 */
import { Client } from "../src/index.js";

async function main() {
  const cnpj = new Client();

  const nubank = await cnpj.lookup("18236120000158");
  const matriz = nubank.estabelecimentos[0];
  console.log(`${nubank.razao_social}, ${matriz.situacao_cadastral}`);

  const results = await cnpj.search("padaria", { perPage: 5 });
  for (const hit of results.results) {
    console.log(`  ${hit.cnpj}  ${hit.razao_social}`);
  }

  const snap = await cnpj.panoramaYear(2024);
  console.log(`\n2024: ${snap.abertas.toLocaleString("pt-BR")} abertas, ${snap.fechadas.toLocaleString("pt-BR")} fechadas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
