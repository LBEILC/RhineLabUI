// Local-only phone review server. Reports contain timing and browser metrics.
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const output = resolve(".tools/mobile-calibration");
await mkdir(output, { recursive: true });
const server = await createServer({
  server: { host: "0.0.0.0", port: 5189, strictPort: true },
  plugins: [{
    name: "local-mobile-calibration",
    configureServer(server) {
      server.middlewares.use("/__mobile-review", (req, res) => {
        if (req.method !== "POST" || req.headers.origin !== `http://${req.headers.host}`) {
          res.writeHead(403).end(); return;
        }
        let body = "";
        req.on("data", chunk => {
          body += chunk;
          if (body.length > 131072) { res.writeHead(413).end(); req.destroy(); }
        });
        req.on("end", async () => {
          try {
            const report = JSON.parse(body);
            if (report.version !== 1 || !Array.isArray(report.samples) || report.samples.length > 30)
              throw new Error("Invalid report");
            const id = `${Date.now()}-${randomUUID()}`;
            await writeFile(resolve(output, `${id}.json`), JSON.stringify({ receivedAt: new Date().toISOString(), ...report }, null, 2));
            res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id }));
            console.log(`Mobile calibration received: ${id} (${String(report.userAgent).slice(0, 180)})`);
          } catch { res.writeHead(400).end(); }
        });
      });
    },
  }],
});
await server.listen();
server.printUrls();
console.log("Open /reference/mobile-review.html on the phone; keep the tab visible during measurement.");
