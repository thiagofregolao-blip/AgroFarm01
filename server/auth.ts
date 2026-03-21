// Blueprint: javascript_auth_all_persistance - Authentication setup
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((entry, ip) => {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  });
}, 30 * 60 * 1000);

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  if (!stored) return false;

  if (!stored.includes(".")) {
    // Reject unhashed passwords — force user to reset via "Esqueci minha senha"
    console.warn("Login attempt with unhashed password detected. User must reset password.");
    return false;
  }

  try {
    const [hashed, salt] = stored.split(".");
    if (!salt) return false;

    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: (() => {
      if (!process.env.SESSION_SECRET) {
        console.error("FATAL: SESSION_SECRET environment variable is not set. Server cannot start securely.");
        process.exit(1);
      }
      return process.env.SESSION_SECRET;
    })(),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const cleanUsername = username.trim();
        const user = await storage.getUserByUsername(cleanUsername);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else if (user.isActive === false) {
          return done(null, false, { message: "Conta desativada" });
        } else {
          return done(null, user);
        }
      } catch (error) {
        console.error("LocalStrategy login error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // Usuário não existe mais no banco - sessão inválida
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error('Error deserializing user:', err);
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    // Check if user registration is allowed
    const settings = await storage.getSystemSettings();
    if (settings && settings.allowUserRegistration === false) {
      return res.status(403).json({ error: "User registration is currently disabled" });
    }

    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    // Whitelist allowed fields to prevent mass assignment (e.g. setting role via body)
    const { username, password, name, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const user = await storage.createUser({
      username,
      name: name || username,
      password: await hashPassword(password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const { allowed, retryAfterMs } = checkRateLimit(clientIp);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `Muitas tentativas de login. Tente novamente em ${Math.ceil(retryAfterSec / 60)} minutos.`
      });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);

      // Destroy session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Error destroying session:", destroyErr);
        }

        // Clear session cookie
        res.clearCookie('connect.sid');

        // Add cache control headers to prevent caching
        res.set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// Middleware to protect routes
export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Middleware to protect admin routes
export function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ error: "Administrator access required" });
  }
  next();
}

// Middleware to protect manager routes
export function requireManager(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== 'gerente' && req.user.role !== 'administrador') {
    return res.status(403).json({ error: "Manager or administrator access required" });
  }
  next();
}

// Middleware to protect farm admin routes (admin_agricultor OR administrador)
export function requireFarmAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== 'admin_agricultor' && req.user.role !== 'administrador') {
    return res.status(403).json({ error: "Farm administrator access required" });
  }
  next();
}
