// Run this file to generate the API and TRPC client

import { generateApiClient } from "../src/index";
import { generateTrpcClient } from "../src/trpc-client-generator";
import { generateTrpcServer } from "../src/trpc-server-generator";
// generateApiClient({
//   apiName: "LajitApi",
//   generatedDir: "./example/__generated__",
//   swaggerUrl: "https://back.lajit.com/swagger/doc.json",
// });

// generateTrpcServer
// generateTrpcClient("./example");

generateTrpcServer(
  "./example/routers",
  "LajitApi",
  "https://back.lajit.com/swagger/doc.json"
);
