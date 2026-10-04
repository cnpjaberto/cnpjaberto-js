import { Client } from "../dist/index.js";

if (!process.env.CNPJABERTO_API_KEY) {
  console.error("Defina CNPJABERTO_API_KEY para executar o smoke test online.");
  process.exitCode = 1;
} else {
  const client = new Client();
  try {
    const company = await client.lookup("18236120000158");
    console.log(
      company.razao_social,
      company.estabelecimentos[0]?.situacao_cadastral,
    );
    console.log(await client.search("padaria", { perPage: 5 }));
    console.log(await client.panoramaCatalog());
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
