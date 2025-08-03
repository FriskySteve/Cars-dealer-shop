import { createServer, IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { Car, Mimes } from "./types";
import { getUsers, saveUsers, getCars, saveCars } from "./db";
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

async function loadCars(res: ServerResponse, req: IncomingMessage) {
  const data = getCars();
  if (!data) {
    res
      .writeHead(400, { "content-type": "application/json" })
      .end({ error: "Błąd przy pobieraniu danych samochodów z bazy danych." });
    return;
  } else {
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(data));
    return;
  }
}

async function addCar(res: ServerResponse, req: IncomingMessage) {
  const data = await getData(req);
  const { model, price } = await JSON.parse(data);
  const newCar: Car = {
    id: `car${Date.now()}`,
    model,
    price,
    ownerId: [""],
  };
  const cars = getCars();

  cars.push(newCar);
  saveCars(cars);
  res
    .writeHead(201, { "content-type": "application/json" })
    .end(JSON.stringify(newCar));
}

async function buyCar(
  res: ServerResponse,
  req: IncomingMessage,
  pathname: string
) {
  const cars = getCars();
  const users = getUsers();
  const carId = pathname.split("/")[2];
  const token = req.headers.cookie ? parseCookies(req).token : null;
  const car = cars.find((c) => c.id === carId);
  const active_user = token ? getUserFromToken(token) : null;
  const user = users.find((u) => u.id === active_user?.id);

  if (!user) {
    res
      .writeHead(403, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Brak uprawnień." }));
    return;
  } else if (!car) {
    res
      .writeHead(404, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "Samochód nie znaleziony." }));
    return;
  } else if (user.balance < car.price) {
    res
      .writeHead(400, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "Niewystarczające środki na koncie." }));
    return;
  } else {
    user.balance -= car.price;
    car.ownerId.push(user.id);
    saveUsers(users);
    saveCars(cars);

    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ message: "Zakup samochodu powiódł się." }));
  }
}

async function deleteCar(
  res: ServerResponse,
  req: IncomingMessage,
  carId: string
) {
  const cars = getCars();
  const users = getUsers();
  const token = req.headers.cookie ? parseCookies(req).token : null;
  const active_user = token ? getUserFromToken(token) : null;
  const user = users.find((u) => u.id === active_user?.id);
  const carToDelte = cars.find((c) => c.id === carId);

  if (user?.role !== "admin") {
    res
      .writeHead(403, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Brak uprawnień." }));
    return;
  } else if (!carToDelte) {
    res
      .writeHead(404, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Samochód nie znaleziony." }));
    return;
  } else {
    const updatedCars = cars.filter((c) => c.id !== carId);
    saveCars(updatedCars);
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Samochód został usunięty." }));
  }
}

async function deleteUser(
  res: ServerResponse,
  req: IncomingMessage,
  userId: string
) {
  const users = getUsers();
  const userToDelete = users.find((u) => u.id === userId);
  const token = req.headers.cookie ? parseCookies(req).token : null;
  const active_user = token ? getUserFromToken(token) : null;

  if (active_user?.role !== "admin") {
    res
      .writeHead(403, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Brak uprawnień." }));
    return;
  } else if (!userToDelete) {
    res
      .writeHead(404, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Użytkownik nie znaleziony." }));
    return;
  } else {
    const updatedUsers = users.filter((u) => u.id !== userId);
    saveUsers(updatedUsers);
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Użytkownik został usunięty." }));
  }
}

async function updateCars(
  res: ServerResponse,
  req: IncomingMessage,
  carId: string
) {
  const cars = getCars();
  const users = getUsers();
  const token = req.headers.cookie ? parseCookies(req).token : null;
  const active_user = token ? getUserFromToken(token) : null;
  const user = users.find((u) => u.id === active_user?.id);
  const carToUpdate = cars.find((c) => c.id === carId);

  if (user?.role !== "admin") {
    res
      .writeHead(403, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Brak uprawnień." }));
    return;
  } else if (!carToUpdate) {
    res
      .writeHead(404, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Samochód nie znaleziony." }));
    return;
  } else {
    const data = await getData(req);
    const { model, price } = JSON.parse(data);
    if (!model || !price) {
      res
        .writeHead(400, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: "Błędne dane." }));
      return;
    }

    carToUpdate.model = model;
    carToUpdate.price = price;
    saveCars(cars);
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Samochód został zaktualizowany." }));
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

    //Cars
    if (method === "GET" && pathname === "/cars") {
      const token = req.headers.cookie ? parseCookies(req).token : null;
      const user = token ? getUserFromToken(token) : null;

      if (!user) {
        res
          .writeHead(403, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Brak uprawnień." }));
        return;
      } else {
        await loadCars(res, req);
        return;
      }
    }

    // Add car
    if (method === "POST" && pathname === "/cars") {
      const token = req.headers.cookie ? parseCookies(req).token : null;
      const user = token ? getUserFromToken(token) : null;

      if (user?.role !== "admin") {
        res
          .writeHead(403, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Brak uprawnień." }));
        return;
      } else {
        await addCar(res, req);
        return;
      }
    }

    // Buy car
    if (method === "POST" && pathname?.endsWith("/buy")) {
      await buyCar(res, req, pathname);
      return;
    }

    // Delete car
    if (method === "DELETE" && pathname?.startsWith("/cars")) {
      const carId = pathname.split("/")[2];
      return deleteCar(res, req, carId);
    }

    // Delete user
    if (method === "DELETE" && pathname?.startsWith("/users")) {
      const userId = pathname.split("/")[2];
      return deleteUser(res, req, userId);
    }
  }
);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
