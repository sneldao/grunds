/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentmail from "../agentmail.js";
import type * as apiCache from "../apiCache.js";
import type * as crons from "../crons.js";
import type * as exchange from "../exchange.js";
import type * as firecrawl from "../firecrawl.js";
import type * as gameConfig from "../gameConfig.js";
import type * as http from "../http.js";
import type * as letters from "../letters.js";
import type * as openai from "../openai.js";
import type * as regulars from "../regulars.js";
import type * as stands from "../stands.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  apiCache: typeof apiCache;
  crons: typeof crons;
  exchange: typeof exchange;
  firecrawl: typeof firecrawl;
  gameConfig: typeof gameConfig;
  http: typeof http;
  letters: typeof letters;
  openai: typeof openai;
  regulars: typeof regulars;
  stands: typeof stands;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
