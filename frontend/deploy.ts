#!/usr/bin/env -S deno run --allow-read --allow-net

// Simple static file server for Deno Deploy
// This serves the built frontend files

const STATIC_DIR = "./dist";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Default to index.html for root path
  if (pathname === "/") {
    pathname = "/index.html";
  }

  // For client-side routing, serve index.html for any non-asset path
  if (!pathname.includes(".")) {
    pathname = "/index.html";
  }

  try {
    const filePath = `${STATIC_DIR}${pathname}`;
    const file = await Deno.readFile(filePath);
    
    // Determine content type
    let contentType = "text/plain";
    if (pathname.endsWith(".html")) contentType = "text/html";
    else if (pathname.endsWith(".js")) contentType = "application/javascript";
    else if (pathname.endsWith(".css")) contentType = "text/css";
    else if (pathname.endsWith(".json")) contentType = "application/json";
    else if (pathname.endsWith(".png")) contentType = "image/png";
    else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (pathname.endsWith(".svg")) contentType = "image/svg+xml";
    else if (pathname.endsWith(".ico")) contentType = "image/x-icon";

    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": pathname === "/index.html" ? "no-cache" : "public, max-age=31536000",
      },
    });
  } catch (e) {
    // If file not found, serve index.html for client-side routing
    if (e instanceof Deno.errors.NotFound) {
      try {
        const indexFile = await Deno.readFile(`${STATIC_DIR}/index.html`);
        return new Response(indexFile, {
          headers: {
            "content-type": "text/html",
            "cache-control": "no-cache",
          },
        });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
    
    return new Response("Internal Server Error", { status: 500 });
  }
}

Deno.serve(handler);