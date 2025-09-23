import { App } from "fresh";
import { define, type State } from "./utils.ts";

export const app = new App<State>();

// Static files middleware
const staticFilesMiddleware = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);
  if (url.pathname.startsWith("/static/")) {
    try {
      const file = await Deno.readFile(`.${url.pathname}`);
      const ext = url.pathname.split('.').pop();
      const contentType = {
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream';
      
      return new Response(file, {
        headers: { 'Content-Type': contentType },
      });
    } catch {
      // File not found, continue to next middleware
    }
  }
  return ctx.next();
});

app.use(staticFilesMiddleware);

// Logger middleware
const loggerMiddleware = define.middleware((ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  return ctx.next();
});
app.use(loggerMiddleware);

// API routes
app.get("/api/:name", (ctx) => {
  const name = ctx.params.name;
  return new Response(
    `Hello, ${name.charAt(0).toUpperCase() + name.slice(1)}!`,
  );
});

// Routes configuration
export const config = {
  router: {
    trailingSlash: false,
  },
};

export default app;

if (import.meta.main) {
  await app.listen();
}
