import { createServer, IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { Mimes } from "./types";

const PORT = 3000;

const MIME_TYPES: Mimes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
};

const sendFile = (res: ServerResponse, filePath: string) => {
  fs.readFile(filePath, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
    res.end(data);
  });
};

const parseBody = (req: IncomingMessage) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });

const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    const pathname = req.url;
    const method = req.method;
    const frontendPath = path.join(__dirname, "..", "frontend");
    if (method === "GET" && pathname === "/")
      return sendFile(res, `${frontendPath}/index.html`);
    if (method === "GET" && pathname?.startsWith("/style.css"))
      return sendFile(res, `${frontendPath}/style.css`);
    if (method === "GET" && pathname?.startsWith("/main.js"))
      return sendFile(res, `${frontendPath}/main.js`);

    res.end(JSON.stringify({ status: "ok" }));
  }
);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
