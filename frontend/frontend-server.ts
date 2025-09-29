import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const PORT = Deno.env.get("PORT") || "5173";

// Function to determine MIME type based on file extension
function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    "html": "text/html",
    "js": "application/javascript",
    "css": "text/css",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "json": "application/json",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "ttf": "font/ttf",
    "otf": "font/otf",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let path = url.pathname;

  // Serve index.html for the root path and all non-file routes (for SPA routing)
  if (path === "/" || !path.includes(".")) {
    path = "/index.html";
  }

  try {
    // Try to read the file from the dist directory
    const file = await Deno.readFile(`./dist${path}`);
    return new Response(file, {
      headers: {
        "content-type": getMimeType(path),
        "cache-control": path.includes(".html") ? "no-cache" : "public, max-age=31536000",
      },
    });
  } catch (error) {
    // If file not found, serve index.html (for client-side routing)
    if (error instanceof Deno.errors.NotFound) {
      try {
        const indexFile = await Deno.readFile("./dist/index.html");
        return new Response(indexFile, {
          headers: {
            "content-type": "text/html",
            "cache-control": "no-cache",
          },
        });
      } catch {
        return new Response("404 Not Found", { status: 404 });
      }
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log(`🚀 Frontend server running on http://localhost:${PORT}/`);
await serve(handler, { port: PORT });