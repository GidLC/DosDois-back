import express from 'express';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import cors from 'cors';
import { host, user, password, database, port } from './dbConfig.mjs';

import enviaWhats from './data/enviaWhats/enviaWhats.mjs';

const app = express();
const nomeAPI = 'apiDDV1'

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({limit: '10mb'}));

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
      console.log(`Não foi possível abri o pool de conexões`);
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
