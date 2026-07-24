import express from 'express';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import cors from 'cors';
import { host, user, password, database, port } from './dbConfig.mjs';
import { CORS_ORIGINS } from '../data/apiConfig.mjs';

import enviaWhats from '../data/enviaWhats/enviaWhats.mjs';

const app = express();
const nomeAPI = 'apiDDV1'
const bodyLimit = process.env.BODY_LIMIT ?? '3mb';

const sensitiveRateLimits = new Map();
const rateLimit = ({ windowMs, max }) => (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `${ip}:${req.path}`;
  const current = sensitiveRateLimits.get(key) ?? { count: 0, resetAt: now + windowMs };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  sensitiveRateLimits.set(key, current);

  if (current.count > max) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }

  next();
};

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS'));
  },
}));

app.use((req, res, next) => {
  const sensitivePath = /^\/apiDDv1\/(auth\/(login|buscaCadEmail|validaToken|mudaSenha|loginGoogle)|subs\/createSub)/.test(req.path);
  if (!sensitivePath) return next();
  return rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })(req, res, next);
});

app.use(bodyParser.urlencoded({ extended: true, limit: bodyLimit }));
app.use(bodyParser.json({ limit: bodyLimit }));

const pool = mysql.createPool({
  host: host,
  user: user,
  password: password,
  database: database,
  port: port,
  waitForConnections: true,
  connectionLimit: 50,
  maxIdle: 50, // Conexões ociosas máximas
  idleTimeout: 60000, // Timeout de conexões ociosas em milissegundos
  queueLimit: 0, // Sem limite de fila
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

//Testando pool de conexões
pool.getConnection((err, conn) => {
  try {
    if(err) {
      console.log(`Não foi possível abri o pool de conexões. ${err}`);
    }
    console.log(`Conexão estabelecida via Pool`);
    //enviaWhats('+554396622714', 'O Servidor do APP DosDois acaba de ser reiniciado');
  
    setTimeout(() => {
      pool.releaseConnection(conn)
      console.log(`Pool liberado`);
    }, 5000)
  } catch (error) {
    console.error(`Houve um erro na conexão com o BD. ${error}`)
  }

})



export { app, pool, nomeAPI};
