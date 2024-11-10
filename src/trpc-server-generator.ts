import path from "path";
import fs from "fs";
import {
  generateApi,
  ParsedRoute,
  GenerateApiOutput,
  RequestContentKind,
  SCHEMA_TYPES,
} from "swagger-typescript-api";
import { ensureDirExists } from "./helpers";
import { OpenAPIV3 } from "openapi-types";
import { z } from "zod";

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

interface RouteConfig {
  name: string;
  method: HttpMethod;
  path: string;
  description?: string;
  isProtected: boolean;
  input: {
    params?: Record<string, any>;
    query?: Record<string, any>;
    body?: any;
  };
  output?: any;
  apiCall: string;
}

interface RouterConfig {
  name: string;
  schemas: Record<string, any>;
  routes: RouteConfig[];
}

async function generateTrpcServer(
  routersDir: string,
  swaggerUrl: string
): Promise<void> {
  try {
    new URL(swaggerUrl);
  } catch (error) {
    throw new Error(
      `Invalid swagger URL: "${swaggerUrl}". Please provide a valid URL starting with http:// or https://`
    );
  }

  console.log("Generating tRPC server from:", swaggerUrl);

  const routers: RouterConfig[] = [];
  const globalSchemas: Record<string, any> = {};

  try {
    // First pass: collect schemas
    await generateApi({
      name: "api.ts",
      url: swaggerUrl,
      generateClient: false,
      generateRouteTypes: true,
      hooks: {
        onParseSchema: (originalSchema: any, parsedSchema: any) => {
          if (originalSchema.title) {
            globalSchemas[originalSchema.title] =
              convertToZodSchema(parsedSchema);
          }
          return parsedSchema;
        },
      },
    });

    // Second pass: process routes
    await generateApi({
      name: "api.ts",
      url: swaggerUrl,
      generateClient: false,
      generateRouteTypes: true,
      hooks: {
        onCreateRoute: (routeData: ParsedRoute) => {
          const router = processRoute(routeData, globalSchemas);
          if (router) {
            const existing = routers.find((r) => r.name === router.name);
            if (existing) {
              existing.routes.push(...router.routes);
              Object.assign(existing.schemas, router.schemas);
            } else {
              routers.push(router);
            }
          }
          return routeData;
        },
      },
    });

    // Generate files
    await generateRouterFiles(routers, routersDir);
    await generateHelperFiles(routersDir);

    console.log("tRPC server generation completed successfully!");
  } catch (error) {
    throw new Error(
      `Failed to generate tRPC server: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function processRoute(
  routeData: ParsedRoute,
  globalSchemas: Record<string, any>
): RouterConfig | null {
  const pathParts = routeData.raw.route.split("/");
  if (pathParts.length < 2) return null;

  const resource = pathParts[1];
  const routerName = `${resource}Router`;
  const method = routeData.raw.method.toLowerCase() as HttpMethod;

  const schemas: Record<string, any> = {};
  const route: RouteConfig = {
    name: routeData.routeName.usage,
    method,
    path: routeData.raw.route,
    description: routeData.raw.description,
    isProtected: method !== "get",
    input: {},
    apiCall: buildApiCall(routeData, resource),
  };

  // Process path parameters
  const pathParams = pathParts
    .filter((part) => part.startsWith("{") && part.endsWith("}"))
    .map((param) => param.slice(1, -1));
  if (pathParams.length) {
    route.input.params = pathParams.reduce(
      (acc, param) => ({ ...acc, [param]: "z.string()" }),
      {}
    );
  }

  // Process query parameters
  const queryParams = pathParts
    .filter((part) => part.includes("?"))
    .map((part) => part.split("?")[1])
    .map((param) => param.split("=")[0]);
  if (queryParams.length) {
    route.input.query = queryParams.reduce(
      (acc, param) => ({ ...acc, [param]: "z.string()" }),
      {}
    );
  }

  // Process request body
  if (routeData.raw.requestBody) {
    const bodySchema = processRequestBody(
      routeData.raw.requestBody as OpenAPIV3.RequestBodyObject,
      schemas,
      globalSchemas
    );
    if (bodySchema) route.input.body = bodySchema;
  }

  // Process response
  if (routeData.raw.responses) {
    route.output = processResponse(
      routeData.raw.responses,
      schemas,
      globalSchemas
    );
  }

  return {
    name: routerName,
    schemas,
    routes: [route],
  };
}

function generateRouterFiles(
  routers: RouterConfig[],
  routersDir: string
): void {
  ensureDirExists(routersDir);

  // Generate individual router files
  routers.forEach((router) => {
    const content = generateRouterContent(router);
    fs.writeFileSync(
      path.join(routersDir, `${router.name.toLowerCase()}.ts`),
      content
    );
  });

  // Generate _app.ts
  const appContent = generateAppRouter(routers);
  fs.writeFileSync(path.join(routersDir, "_app.ts"), appContent);
}

// Generate router content
function generateRouterContent(router: RouterConfig): string {
  const schemas = Object.entries(router.schemas)
    .map(([name, schema]) => `const ${name} = ${schema};`)
    .join("\n\n");

  const routes = router.routes
    .map((route) => generateRouteContent(route))
    .join(",\n\n");

  return `import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

${schemas ? `// Schema definitions\n${schemas}\n\n` : ""}
export const ${router.name} = router({
${routes}
});`;
}

function generateRouteContent(route: RouteConfig): string {
  const procedureType = route.isProtected
    ? "protectedProcedure"
    : "publicProcedure";
  const inputSchema = generateInputSchema(route.input);

  return `  // ${route.description || route.name}
  ${route.name}: ${procedureType}
    .input(${inputSchema})
    .${route.method === "get" ? "query" : "mutation"}(async ({ input, ctx }) => {
      try {
        const response = await ${route.apiCall};
        return response;
      } catch (error) {
        throw new TRPCError({
          code: '${route.method === "get" ? "NOT_FOUND" : "BAD_REQUEST"}',
          message: 'Failed to ${route.method} ${route.path}',
          cause: error
        });
      }
    })`;
}

function generateInputSchema(input: RouteConfig["input"]): string {
  if (!input.params && !input.query && !input.body) {
    return "z.object({})";
  }

  const schemaProps: string[] = [];

  if (input.params) {
    Object.entries(input.params).forEach(([key, schema]) => {
      schemaProps.push(`    ${key}: ${schema}`);
    });
  }

  if (input.query) {
    Object.entries(input.query).forEach(([key, schema]) => {
      schemaProps.push(`    ${key}: ${schema}`);
    });
  }

  if (input.body) {
    schemaProps.push(`    data: ${input.body}`);
  }

  return `z.object({\n${schemaProps.join(",\n")}\n  })`;
}

function generateAppRouter(routers: RouterConfig[]): string {
  const imports = routers
    .map(
      (router) =>
        `import { ${router.name} } from './${router.name.toLowerCase()}';`
    )
    .join("\n");

  const merges = routers
    .map(
      (router) =>
        `  ${router.name.replace("Router", "").toLowerCase()}: ${router.name},`
    )
    .join("\n");

  return `import { router } from '../trpc';
${imports}

export const appRouter = router({
${merges}
});

export type AppRouter = typeof appRouter;`;
}

async function generateHelperFiles(routersDir: string): Promise<void> {
  // Generate context.ts
  const contextContent = `import { inferAsyncReturnType } from '@trpc/server';
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { getSession } from 'next-auth/react';
import { Api } from '../generated/api';

export async function createContext({ req, res }: CreateNextContextOptions) {
  const session = await getSession({ req });
  
  return {
    req,
    res,
    session,
    api: new Api({
      baseUrl: process.env.API_BASE_URL!,
    }),
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;`;

  // Generate trpc.ts
  const trpcContent = `import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);`;

  fs.writeFileSync(path.join(routersDir, "../context.ts"), contextContent);
  fs.writeFileSync(path.join(routersDir, "../trpc.ts"), trpcContent);
}

function convertToZodSchema(parsedSchema: any): string {
  // Basic type mapping
  switch (parsedSchema.type) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "object":
      if (parsedSchema.properties) {
        const props = Object.entries(parsedSchema.properties)
          .map(
            ([key, value]: [string, any]) =>
              `${key}: ${convertToZodSchema(value)}`
          )
          .join(",\n");
        return `z.object({\n${props}\n})`;
      }
      return "z.object({})";
    case "array":
      if (parsedSchema.items) {
        return `z.array(${convertToZodSchema(parsedSchema.items)})`;
      }
      return "z.array(z.unknown())";
    default:
      return "z.unknown()";
  }
}

function processParameters(parameters: OpenAPIV3.ParameterObject[]): {
  params: Record<string, string>;
  query: Record<string, string>;
} {
  const params: Record<string, string> = {};
  const query: Record<string, string> = {};

  parameters.forEach((param) => {
    const schema = convertToZodSchema(param.schema || { type: "string" });
    if (param.in === "path") {
      params[param.name] = schema;
    } else if (param.in === "query") {
      query[param.name] = param.required ? schema : `${schema}.optional()`;
    }
  });

  return { params, query };
}

function processRequestBody(
  requestBody: OpenAPIV3.RequestBodyObject,
  schemas: Record<string, any>,
  globalSchemas: Record<string, any>
): string | null {
  const content = requestBody?.content;
  if (!content || !content["application/json"]) return null;

  const schema = content["application/json"].schema;
  if (!schema) return null;

  if ("$ref" in schema) {
    const refName = schema.$ref.split("/").pop() || "";
    return globalSchemas[refName] || "z.unknown()";
  }

  return convertToZodSchema(schema);
}

function processResponse(
  responses: OpenAPIV3.ResponsesObject,
  schemas: Record<string, any>,
  globalSchemas: Record<string, any>
): string {
  const successResponse = responses["200"] || responses["201"];
  if (!successResponse) return "z.unknown()";

  const content = (successResponse as OpenAPIV3.ResponseObject).content;
  if (!content || !content["application/json"]) return "z.unknown()";

  const schema = content["application/json"].schema;
  if (!schema) return "z.unknown()";

  if ("$ref" in schema) {
    const refName = schema.$ref.split("/").pop();
    return refName && globalSchemas[refName] ? globalSchemas[refName] : "z.unknown()";
  }

  return convertToZodSchema(schema);
}

function buildApiCall(routeData: ParsedRoute, resource: string): string {
  const method = routeData.raw.method.toLowerCase();
  const pathParams = routeData.raw.route
    .split("/")
    .filter((part) => part.startsWith("{") && part.endsWith("}"))
    .map((param) => param.slice(1, -1))
    .map((param) => `\${input.params.${param}}`)
    .join("/");
  const queryParams = routeData.raw.route
    .split("/")
    .filter((part) => part.includes("?"))
    .map((part) => part.split("?")[1])
    .map((param) => param.split("=")[0])
    .map((param) => `${param}=\${input.query?.${param} ?? ''}`)
    .join("&");
  const bodyParam = routeData.raw.requestBody
    ? "data: input.data"
    : "data: undefined";

  return `ctx.api.${resource}.${routeData.raw.operationId}(${pathParams}${
    queryParams ? `?${queryParams}` : ""
  }, { ${bodyParam} })`;
}

export { generateTrpcServer };
