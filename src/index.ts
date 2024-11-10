import { generateApiClient } from "./openapi";
import dotenv from "dotenv";
import path from "path";
import { generateTrpcClient } from "./trpc-client-generator";
import fs from "fs";
import { generateTrpcServer } from "./trpc-server-generator";

const possibleEnvPaths = [
  path.resolve(process.cwd(), "example/.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env"),
].map((p) => ({ path: p, label: path.relative(process.cwd(), p) }));

// Load environment variables
let envLoaded = false;
for (const { path: envPath, label } of possibleEnvPaths) {
  console.log(`Checking .env at: ${label}`);
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    console.log(`Loaded .env from: ${label}`);
    break;
  }
}

if (!envLoaded) {
  console.warn("No .env file found. Using environment variables directly...");
}

// Required environment variables
const requiredEnvVars = {
  GENERATED_DIR: process.env.GENERATED_DIR,
  SWAGGER_URL: process.env.SWAGGER_URL,
  API_NAME: process.env.API_NAME,
} as const;

// Validate environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
}

// Resolve paths
const projectRoot = path.resolve(process.cwd(), "../../");
const srcDir = path.resolve(projectRoot, "src");

// Determine generated directory - if src exists, use it as base path
const baseDir = fs.existsSync(srcDir) ? srcDir : projectRoot;
const generatedDir = path.resolve(baseDir, requiredEnvVars.GENERATED_DIR!);

const trpcRoot = (() => {
  return fs.existsSync(srcDir) ? srcDir : projectRoot;
})();

// Generate clients
generateApiClient({
  apiName: requiredEnvVars.API_NAME!,
  generatedDir,
  swaggerUrl: requiredEnvVars.SWAGGER_URL!,
});

generateTrpcClient(trpcRoot);

// routersdir
const trpcServerDir = path.resolve(trpcRoot, "server");
const routersDir = path.resolve(trpcServerDir, "routers");
generateTrpcServer(
  routersDir,
  requiredEnvVars.API_NAME!,
  requiredEnvVars.SWAGGER_URL!
);

console.log(`
API files generated successfully:
  Generated directory: ${generatedDir}
  Swagger URL: ${requiredEnvVars.SWAGGER_URL}
  API Name: ${requiredEnvVars.API_NAME}
  TRPC Server directory: ${trpcServerDir}
  TRPC Routers directory: ${routersDir}
`);

export { generateApiClient };
