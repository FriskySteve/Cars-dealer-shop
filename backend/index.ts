import { createServer, IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { Mimes } from "./types";
import { getUsers, saveUsers } from "./db";
import { User } from "./types";
import {
  generateToken,
  setAuthCookie,
  getUserFromToken,
  parseCookies,
} from "./auth";

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
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "text/plain",
    });
    res.end(data);
  });
};

export async function getData(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
  });
}

async function loginUser(
  res: ServerResponse,
  req: IncomingMessage
): Promise<void> {
  const body = await getData(req);
  const { username, password } = await JSON.parse(body);
  const users = getUsers();

  const user = users.find(
    (u) => username === u.username && password === u.password
  );

  if (!user)
    res
      .writeHead(401, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "Błędne dane do logowania." }));
  else {
    const token = generateToken(user.id);

    setAuthCookie(res, token);
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({}));
  }
}

const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    const pathname = req.url;
    const method = req.method;
    const frontendPath = path.join(__dirname, "..", "frontend");

    // Static files
    if (method === "GET" && pathname === "/")
      return sendFile(res, `${frontendPath}/index.html`);
    if (method === "GET" && pathname?.startsWith("/style.css"))
      return sendFile(res, `${frontendPath}/style.css`);
    if (method === "GET" && pathname?.startsWith("/main.js"))
      return sendFile(res, `${frontendPath}/main.js`);

    // SSE
    if (method === "GET" && pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("data: Witaj SSE!\n\n");
      return;
    }

    // Register
    if (method === "POST" && pathname === "/register") {
      const data = await getData(req);
      const { username, password } = JSON.parse(data);
      if (!username || !password) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(
            JSON.stringify({ error: "Błędna nazwa użytkownika, podaj inną." })
          );
        return;
      }

      const users = getUsers();
      if (users.find((u) => u.username === username)) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Użytkownik już istnieje." }));
        return;
      }

      const newUser: User = {
        id: `${username}${Date.now()}`,
        username,
        password,
        role: "user",
        balance: 50000,
      };
      users.push(newUser);
      saveUsers(users);
      res
        .writeHead(201, { "Content-Type": "application/json" })
        .end(JSON.stringify({ message: "Zarejestrowano pomyślnie." }));
      return;
    }

    // Login
    if (method === "POST" && pathname === "/login") {
      const data = await getData(req);
      const { username, password } = JSON.parse(data);
      if (!username || !password) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(
            JSON.stringify({ error: "Błędna nazwa użytkownika lub hasło." })
          );
        return;
      }

      const users = getUsers();
      const user = users.find(
        (u) => u.username === username && u.password === password
      );
      if (!user) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Nieprawidłowe dane logowania." }));
        return;
      }
      loginUser(res, req);
      setAuthCookie(res, generateToken(user.id));
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          message: "Zalogowano pomyślnie.",
          user: { id: user.id, username: user.username, role: user.role },
        })
      );
      return;
    }

    // Users
    if (method === "GET" && pathname === "/users") {
      const token = req.headers.cookie ? parseCookies(req).token : null;
      const user = token ? getUserFromToken(token) : null;

      if (!user) {
        res
          .writeHead(403, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Brak uprawnień." }));
        return;
      } else if (user.role === "admin") {
        const users = getUsers();
        res
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(users));
        return;
      } else {
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify(user));
        return;
      }
    }

    // Fallback
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nie znaleziono ścieżki." }));
  }
);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
