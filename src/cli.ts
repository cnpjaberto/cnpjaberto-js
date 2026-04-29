#!/usr/bin/env node
import { runStdio } from "./mcp.js";

runStdio().catch((err) => {
  console.error("[cnpjaberto-mcp] erro fatal:", err);
  process.exit(1);
});
