import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const port = 8000;

serve((req: Request) => {
  // Serve static files from the dist directory
  return serveDir(req, {
    fsRoot: "dist",
    urlRoot: "",
    showDirListing: false,
    enableCors: true,
    quiet: true,
  });
}, { port });

console.log(`Server running on http://localhost:${port}/`);
