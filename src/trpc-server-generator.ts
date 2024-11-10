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

function isReferenceObject(schema: any): schema is { $ref: string } {
  return typeof schema === "object" && schema !== null && "$ref" in schema;
}

async function generateTrpcServer(
  routersDir: string,
  apiName: string,
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
    await generateHelperFiles(routersDir, apiName);

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
    apiCall: buildApiCall(routeData).call,
  };

  // Process request body type
  let dataType = "z.unknown()";
  if (routeData.raw.requestBody) {
    const content = (routeData.raw.requestBody as OpenAPIV3.RequestBodyObject)
      .content;
    if (content?.["application/json"]?.schema) {
      const schema = content["application/json"].schema;
      if ("$ref" in schema && typeof schema.$ref === "string") {
        const refType = schema.$ref.split("/").pop();
        if (refType && globalSchemas[refType]) {
          dataType = globalSchemas[refType];
        }
      } else if (isReferenceObject(schema) && schema.$ref) {
        const refType = schema.$ref.split("/").pop();
        if (refType && globalSchemas[refType]) {
          dataType = globalSchemas[refType];
        }
      } else if (
        !isReferenceObject(schema) &&
        schema.type === "object" &&
        schema.properties
      ) {
        dataType = convertToZodSchema(schema);
      }
    }
  }

  // Special handling for specific endpoints
  switch (routeData.routeName.usage) {
    case "listCreate":
      route.input = {
        body: {
          limit: "z.number().optional()",
          offset: "z.number().optional()",
          data: dataType,
        },
      };
      break;
    case "vehiclesUpdate":
    case "bulkEditUpdate":
    case "createCreate":
    case "treatmentsCreate":
      route.input.body = {
        data: dataType,
      };
      break;
    default:
      // Process path parameters
      const pathParams = pathParts
        .filter((part) => part.startsWith("{") && part.endsWith("}"))
        .map((param) => param.slice(1, -1));
      if (pathParams.length) {
        route.input.params = pathParams.reduce((acc, param) => {
          const isIdParam = param.toLowerCase().includes("id");
          return {
            ...acc,
            [param]: isIdParam ? "z.number()" : "z.string()",
          };
        }, {});
      }

      // Add data field for methods that need it
      if (["post", "put", "patch"].includes(method)) {
        route.input.body = { data: dataType };
      }
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

async function generateHelperFiles(
  routersDir: string,
  apiName: string
): Promise<void> {
  // Generate context.ts
  const contextContent = `import { inferAsyncReturnType } from '@trpc/server';
import { CreateNextContextOptions } from '@trpc/server/adapters/next';
import { getSession } from 'next-auth/react';
import { Api } from './__generated__/${apiName}';

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

function convertToZodSchema(schema: any): string {
  // Handle $ref
  if (schema.$ref) {
    const refType = schema.$ref.split("/").pop();
    // Return reference to the schema that will be defined
    return `${refType}Schema`;
  }

  // Handle nullable
  const isNullable = schema.nullable || false;
  let zodSchema = "";

  // Handle arrays
  if (schema.type === "array") {
    zodSchema = `z.array(${convertToZodSchema(schema.items)})`;
  }
  // Handle enums
  else if (schema.enum) {
    const enumValues = schema.enum.map((value: any) =>
      typeof value === "string" ? `'${value}'` : value
    );
    zodSchema = `z.enum([${enumValues.join(", ")}])`;
  }
  // Handle objects
  else if (schema.type === "object" || schema.properties) {
    const required = schema.required || [];
    const properties = Object.entries(schema.properties || {})
      .map(([key, prop]: [string, any]) => {
        let propSchema = convertToZodSchema(prop);
        if (!required.includes(key)) {
          propSchema += ".optional()";
        }
        return `  ${key}: ${propSchema}`;
      })
      .join(",\n");
    zodSchema = `z.object({\n${properties}\n})`;
  }
  // Handle primitive types
  else {
    switch (schema.type) {
      case "string":
        zodSchema = "z.string()";
        if (schema.format === "date-time") {
          zodSchema = "z.string().datetime()";
        }
        break;
      case "number":
      case "integer":
        zodSchema = "z.number()";
        break;
      case "boolean":
        zodSchema = "z.boolean()";
        break;
      default:
        zodSchema = "z.unknown()";
    }
  }

  // Add constraints
  if (schema.type === "string") {
    if (schema.minLength) zodSchema += `.min(${schema.minLength})`;
    if (schema.maxLength) zodSchema += `.max(${schema.maxLength})`;
    if (schema.pattern) zodSchema += `.regex(/${schema.pattern}/)`;
  }
  if (schema.type === "number" || schema.type === "integer") {
    if (schema.minimum) zodSchema += `.min(${schema.minimum})`;
    if (schema.maximum) zodSchema += `.max(${schema.maximum})`;
  }

  // Add nullable if needed
  if (isNullable) {
    zodSchema += ".nullable()";
  }

  return zodSchema;
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

function buildApiCall(routeData: ParsedRoute): {
  call: string;
  zodSchema: z.ZodObject<any>;
} {
  const namespace = routeData.namespace;
  const operationId = routeData.raw.operationId || routeData.routeName.usage;

  // Build the API call
  let call = `ctx.api.${namespace}.${operationId}(`;
  const params: string[] = [];

  // Initialize schema properties
  const schemaProperties: Record<string, z.ZodTypeAny> = {};

  // Extract path parameters and build their schema
  const pathParts = routeData.raw.route.split("/");
  const pathParamNames: string[] = [];

  for (const part of pathParts) {
    if (part.startsWith("{") && part.endsWith("}")) {
      const paramName = part.slice(1, -1);
      pathParamNames.push(paramName);

      // Add to schema properties
      schemaProperties[paramName] = z.number(); // Default to number for IDs, adjust if needed
    }
  }

  // Handle path parameters
  pathParamNames.forEach((paramName) => {
    params.push(`input.${paramName}`);
  });

  // // Handle query parameters
  // const queryParams = (routeData.raw.parameters || [])
  //   .filter((param) => param.in === "query")
  //   .map((param) => param.name);

  // if (queryParams.length > 0) {
  //   // If we have path params, we need to merge them with query params
  //   if (pathParamNames.length > 0) {
  //     params[0] =
  //       `{ ${pathParamNames.map((name) => `${name}: input.${name}`).join(", ")},` +
  //       `${queryParams.map((name) => `${name}: input.${name}`).join(", ")} }`;
  //   } else {
  //     params.push(
  //       `{ ${queryParams.map((name) => `${name}: input.${name}`).join(", ")} }`
  //     );
  //   }

  //   // Add query params to schema
  //   queryParams.forEach((paramName) => {
  //     schemaProperties[paramName] = z.string().optional(); // Default to optional string, adjust if needed
  //   });
  // } else if (pathParamNames.length > 0) {
  //   // If we only have path params, wrap them in an object
  //   params[0] = `{ ${pathParamNames.map((name) => `${name}: input.${name}`).join(", ")} }`;
  // }

  // Handle request body
  if (routeData.raw.requestBody) {
    // Add request body schema
    schemaProperties.data = buildRequestBodySchema(routeData.raw.requestBody);

    // Add data parameter to API call
    params.push("input.data");
  }

  // Complete the API call
  call += params.join(", ");
  call += ")";

  // Create the final zod schema
  const zodSchema = z.object(schemaProperties);

  return {
    call,
    zodSchema,
  };
}
function buildRequestBodySchema(requestBody: any): z.ZodTypeAny {
  // Handle different types of request bodies
  if (requestBody.content?.["application/json"]?.schema) {
    const schema = requestBody.content["application/json"].schema;
    return convertOpenAPISchemaToZod(schema);
  }

  // Default to an empty object schema if no specific schema is provided
  return z.object({});
}
function convertOpenAPISchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema) return z.any();

  switch (schema.type) {
    case "object":
      const properties: Record<string, z.ZodTypeAny> = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(
          ([key, value]: [string, any]) => {
            properties[key] = convertOpenAPISchemaToZod(value);
          }
        );
      }
      return z.object(properties);

    case "array":
      return z.array(convertOpenAPISchemaToZod(schema.items));

    case "string":
      if (schema.enum) {
        return z.enum(schema.enum as [string, ...string[]]);
      }
      return z.string();

    case "number":
    case "integer":
      return z.number();

    case "boolean":
      return z.boolean();

    case "null":
      return z.null();

    default:
      return z.any();
  }
}
export { generateTrpcServer };
