"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PORT = 3000;
const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
};
const sendFile = (res, filePath) => {
    fs_1.default.readFile(filePath, (err, data) => {
        if (err)
            return res.writeHead(404).end("Not found");
        const ext = path_1.default.extname(filePath);
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
        res.end(data);
    });
};
const parseBody = (req) => new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
        try {
            resolve(JSON.parse(body));
        }
        catch {
            resolve({});
        }
    });
});
const server = (0, http_1.createServer)(async (req, res) => {
    const pathname = req.url;
    const method = req.method;
    const frontendPath = path_1.default.join(__dirname, "..", "frontend");
    if (method === "GET" && pathname === "/")
        return sendFile(res, `${frontendPath}/index.html`);
    if (method === "GET" && (pathname === null || pathname === void 0 ? void 0 : pathname.startsWith("/style.css")))
        return sendFile(res, `${frontendPath}/style.css`);
    if (method === "GET" && (pathname === null || pathname === void 0 ? void 0 : pathname.startsWith("/main.js")))
        return sendFile(res, `${frontendPath}/main.js`);
    res.end(JSON.stringify({ status: "ok" }));
});
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
