import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import type { NextRequest } from "next/server";

const backendBaseUrl =
  process.env.AG_UI_BACKEND_URL?.replace(/\/agent$/, "") ??
  "http://localhost:8000";

const runtime = new CopilotRuntime({
  agents: {
    haiku_agent: new HttpAgent({ url: `${backendBaseUrl}/agent` }),
    temperature_agent: new HttpAgent({
      url: `${backendBaseUrl}/agent-temperature`,
    }),
  },
});

const serviceAdapter = new ExperimentalEmptyAdapter();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
