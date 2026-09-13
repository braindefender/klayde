import { runCli } from "./process/main.ts";

const code = await runCli(Bun.argv);
process.exit(code);