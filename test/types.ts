import {
  Client,
  type Company,
  type LeadsOptions,
  type OperationResponse,
} from "../src/index.js";
import { buildServer } from "../src/mcp.js";

const client = new Client({ timeoutMs: 1000 });
const company: Promise<Company> = client.lookup("18236120000158");
const leadsOptions: LeadsOptions = { uf: "SP", municipio_codigo: "7107" };
const leads: Promise<OperationResponse<"leads">> = client.leads(leadsOptions);
const csv: Promise<string> = client.panoramaReportCsv("202609");
const cities = client.searchMunicipalities("São Paulo", { uf: "SP" });
cities.then((items) => items.map((item) => item.codigo));
void [company, leads, csv];
void buildServer({ tools: ["lookup_cnpj"], fetchImpl: fetch });
// @ts-expect-error municipality is required
client.leads({ uf: "SP" });
// @ts-expect-error only known tools can be executed
client.execute("arbitrary_path", {});
// @ts-expect-error report segment is a closed union
client.panoramaReport("202609", { recorte: "invalid" });
// @ts-expect-error typed company is not a string
const wrong: Promise<string> = client.lookup("18236120000158");
void wrong;
