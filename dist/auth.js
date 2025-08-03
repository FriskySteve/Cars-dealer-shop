"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.getUserFromToken = getUserFromToken;
exports.setAuthCookie = setAuthCookie;
exports.parseCookies = parseCookies;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("./db");
const SECRET = "nie_powiem";
function generateToken(userId) {
    const token = jsonwebtoken_1.default.sign({ id: userId }, SECRET, { expiresIn: "10m" });
    return token;
}
function getUserFromToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, SECRET);
        return (0, db_1.getUsers)().find((user) => user.id === decoded.id) || null;
    }
    catch {
        return null;
    }
}
function setAuthCookie(res, token) {
    res.setHeader("Set-Cookie", `token=${token}; HttpOnly; Max-Age=600`);
}
function parseCookies(req) {
    const cookieHeader = req.headers.cookie;
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split("; ").forEach((cookie) => {
            const [name, value] = cookie.split("=");
            cookies[name] = decodeURIComponent(value);
        });
    }
    return cookies;
}
