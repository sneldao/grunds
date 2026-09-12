import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// Static site served via the catch-all in convex/http.ts (registerStaticRoutes),
// so app routes (/agentmail/webhook, /sync/*, /api/schedule) keep working at root.
const app = defineApp();
app.use(staticHosting);

export default app;
