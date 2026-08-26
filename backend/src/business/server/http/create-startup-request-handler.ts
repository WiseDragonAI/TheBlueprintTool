/**
 * WHAT: Serves the bounded HTTP contract available while the full server runtime initializes.
 * WHY: Project hydration, watchers, execution recovery, catalogs, and relay work must not gate listener readiness.
 */
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RuntimeIncidentLedger } from "../helper/runtime-incident-ledger.js";
import type { IncidentSupervisor } from "../runtime/incident-supervisor.js";
import { handleDiagnosticReadRoutes } from "./diagnostic-routes.js";
import { serveStaticApplication } from "./static-application-handler.js";

type AnyRecord = Record<string, unknown>;

function readStartupControlRoom(cacheFile: string): AnyRecord | null {
  // WHAT: Return no startup projection when the replaceable cache is absent.
  // WHY: Listener admission must not manufacture task state from missing cache evidence.
  if (!existsSync(cacheFile)) return null;
  try {
    const projection = JSON.parse(readFileSync(cacheFile, "utf8")) as AnyRecord;
    delete projection.dependencies;
    delete projection.projectSlices;
    return { ...projection, stale: true, startupPhase: "loading" };
  } catch {
    // WHAT: Preserve an unreadable cache and expose loading instead of throwing into the listener.
    // WHY: A replaceable projection failure must not prevent health, diagnostics, or static routes.
    return null;
  }
}

export function createStartupRequestHandler(input: {
  controlRoomCacheFile: string;
  frontendRoot: string;
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  settings: unknown;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const cachedControlRoom = readStartupControlRoom(input.controlRoomCacheFile);
  return async (request, response): Promise<void> => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestPath = requestUrl.pathname;
    const diagnostic = handleDiagnosticReadRoutes({
      incidentLedger: input.incidentLedger,
      incidentSupervisor: input.incidentSupervisor,
      request,
      requestPath,
      response,
      settings: input.settings,
    });
    // WHAT: Finish startup-safe diagnostic requests at the durable global boundary.
    // WHY: Diagnostics must not fall through to project-dependent routing while bootstrap is incomplete.
    if (diagnostic.handled) return;
    // WHAT: Serve the last persisted Control Room projection as explicitly stale during bootstrap.
    // WHY: Operators need immediate task visibility without forcing any project task-state store open.
    if (
      request.method === "GET" &&
      requestPath === "/api/control-room" &&
      cachedControlRoom
    ) {
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(cachedControlRoom));
      return;
    }
    // WHAT: Report an explicit loading boundary when no cached Control Room projection exists.
    // WHY: Missing replaceable cache evidence is not an empty authoritative task catalog.
    if (request.method === "GET" && requestPath === "/api/control-room") {
      response.statusCode = 503;
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: false, error: "server-runtime-loading" }),
      );
      return;
    }
    // WHAT: Keep the application shell and immutable frontend modules available during runtime bootstrap.
    // WHY: Static delivery has no dependency on hydrated projects, execution recovery, or federation.
    if (request.method === "GET") {
      serveStaticApplication({
        frontendRoot: input.frontendRoot,
        projectScope: null,
        projects: [],
        request,
        requestPath,
        response,
        url: requestPath,
      });
      return;
    }
    response.statusCode = 503;
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ ok: false, error: "server-runtime-loading" }),
    );
  };
}
