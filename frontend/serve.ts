import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";

const port = parseInt(Deno.env.get("PORT") || "8000");

console.log(`Static file server running on port ${port}`);

serve(async (req: Request) => {
  const url = new URL(req.url);
  const filepath = decodeURIComponent(url.pathname);
  
  // Try to serve the exact file first
  let fileToServe = `dist${filepath}`;
  
  // Check if it's a file request (has extension) or an asset
  const hasExtension = filepath.includes('.');
  const isAsset = filepath.startsWith('/assets/') || hasExtension;
  
  try {
    if (isAsset) {
      // Try to serve the exact file for assets
      const file = await Deno.stat(fileToServe);
      if (file.isFile) {
        return serveFile(req, fileToServe);
      }
    }
  } catch {
    // File doesn't exist, continue to serve index.html
  }
  
  // For all routes without extensions (SPA routes), serve index.html
  return serveFile(req, "dist/index.html");
}, { port });