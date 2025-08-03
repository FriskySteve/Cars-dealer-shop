"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getData = getData;
const http_1 = require("http");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const auth_1 = require("./auth");
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
        res.writeHead(200, {
            "Content-Type": MIME_TYPES[ext] || "text/plain",
        });
        res.end(data);
    });
};
async function getData(req) {
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
async function loginUser(res, req) {
    const body = await getData(req);
    const { username, password } = await JSON.parse(body);
    const users = (0, db_1.getUsers)();
    const user = users.find((u) => username === u.username && password === u.password);
    if (!user)
        res
            .writeHead(401, { "content-type": "application/json" })
            .end(JSON.stringify({ error: "Błędne dane do logowania." }));
    else {
        const token = (0, auth_1.generateToken)(user.id);
        (0, auth_1.setAuthCookie)(res, token);
        res
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({}));
    }
}
async function loadCars(res, req) {
    const data = (0, db_1.getCars)();
    if (!data) {
        res
            .writeHead(400, { "content-type": "application/json" })
            .end({ error: "Błąd przy pobieraniu danych samochodów z bazy danych." });
        return;
    }
    else {
        res
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify(data));
        return;
    }
}
async function addCar(res, req) {
    const data = await getData(req);
    const { model, price } = await JSON.parse(data);
    const newCar = {
        id: `car${Date.now()}`,
        model,
        price,
        ownerId: [""],
    };
    const cars = (0, db_1.getCars)();
    cars.push(newCar);
    (0, db_1.saveCars)(cars);
    res
        .writeHead(201, { "content-type": "application/json" })
        .end(JSON.stringify(newCar));
}
async function buyCar(res, req, pathname) {
    const cars = (0, db_1.getCars)();
    const users = (0, db_1.getUsers)();
    const carId = pathname.split("/")[2];
    const token = req.headers.cookie ? (0, auth_1.parseCookies)(req).token : null;
    const car = cars.find((c) => c.id === carId);
    const active_user = token ? (0, auth_1.getUserFromToken)(token) : null;
    const user = users.find((u) => u.id === (active_user === null || active_user === void 0 ? void 0 : active_user.id));
    if (!user) {
        res
            .writeHead(403, { "Content-Type": "application/json" })
            .end(JSON.stringify({ error: "Brak uprawnień." }));
        return;
    }
    else if (!car) {
        res
            .writeHead(404, { "content-type": "application/json" })
            .end(JSON.stringify({ error: "Samochód nie znaleziony." }));
        return;
    }
    else if (user.balance < car.price) {
        res
            .writeHead(400, { "content-type": "application/json" })
            .end(JSON.stringify({ error: "Niewystarczające środki na koncie." }));
        return;
    }
    else {
        user.balance -= car.price;
        car.ownerId.push(user.id);
        (0, db_1.saveUsers)(users);
        (0, db_1.saveCars)(cars);
        res
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ message: "Zakup samochodu powiódł się." }));
    }
}
const server = (0, http_1.createServer)(async (req, res) => {
    const pathname = req.url;
    const method = req.method;
    const frontendPath = path_1.default.join(__dirname, "..", "frontend");
    // Static files
    if (method === "GET" && pathname === "/")
        return sendFile(res, `${frontendPath}/index.html`);
    if (method === "GET" && (pathname === null || pathname === void 0 ? void 0 : pathname.startsWith("/style.css")))
        return sendFile(res, `${frontendPath}/style.css`);
    if (method === "GET" && (pathname === null || pathname === void 0 ? void 0 : pathname.startsWith("/main.js")))
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
                .end(JSON.stringify({ error: "Błędna nazwa użytkownika, podaj inną." }));
            return;
        }
        const users = (0, db_1.getUsers)();
        if (users.find((u) => u.username === username)) {
            res
                .writeHead(400, { "Content-Type": "application/json" })
                .end(JSON.stringify({ error: "Użytkownik już istnieje." }));
            return;
        }
        const newUser = {
            id: `${username}${Date.now()}`,
            username,
            password,
            role: "user",
            balance: 50000,
        };
        users.push(newUser);
        (0, db_1.saveUsers)(users);
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
                .end(JSON.stringify({ error: "Błędna nazwa użytkownika lub hasło." }));
            return;
        }
        const users = (0, db_1.getUsers)();
        const user = users.find((u) => u.username === username && u.password === password);
        if (!user) {
            res
                .writeHead(401, { "Content-Type": "application/json" })
                .end(JSON.stringify({ error: "Nieprawidłowe dane logowania." }));
            return;
        }
        loginUser(res, req);
        (0, auth_1.setAuthCookie)(res, (0, auth_1.generateToken)(user.id));
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
            message: "Zalogowano pomyślnie.",
            user: { id: user.id, username: user.username, role: user.role },
        }));
        return;
    }
    // Users
    if (method === "GET" && pathname === "/users") {
        const token = req.headers.cookie ? (0, auth_1.parseCookies)(req).token : null;
        const user = token ? (0, auth_1.getUserFromToken)(token) : null;
        if (!user) {
            res
                .writeHead(403, { "Content-Type": "application/json" })
                .end(JSON.stringify({ error: "Brak uprawnień." }));
            return;
        }
        else if (user.role === "admin") {
            const users = (0, db_1.getUsers)();
            res
                .writeHead(200, { "Content-Type": "application/json" })
                .end(JSON.stringify(users));
            return;
        }
        else {
            res
                .writeHead(200, { "content-type": "application/json" })
                .end(JSON.stringify(user));
            return;
        }
    }
    //Cars
    if (method === "GET" && pathname === "/cars") {
        const token = req.headers.cookie ? (0, auth_1.parseCookies)(req).token : null;
        const user = token ? (0, auth_1.getUserFromToken)(token) : null;
        if (!user) {
            res
                .writeHead(403, { "Content-Type": "application/json" })
                .end(JSON.stringify({ error: "Brak uprawnień." }));
            return;
        }
        else {
            await loadCars(res, req);
            return;
        }
    }
    // Add car
    if (method === "POST" && pathname === "/cars") {
        const token = req.headers.cookie ? (0, auth_1.parseCookies)(req).token : null;
        const user = token ? (0, auth_1.getUserFromToken)(token) : null;
        if ((user === null || user === void 0 ? void 0 : user.role) !== "admin") {
            res
                .writeHead(403, { "Content-Type": "application/json" })
                .end(JSON.stringify({ error: "Brak uprawnień." }));
            return;
        }
        else {
            await addCar(res, req);
            return;
        }
    }
    // Buy car
    if (method === "POST" && (pathname === null || pathname === void 0 ? void 0 : pathname.endsWith("/buy"))) {
        await buyCar(res, req, pathname);
        return;
    }
});
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
