import jwt from 'jsonwebtoken';
import { JWT_EXPIRES, JWT_SECRET } from '../data/apiConfig.mjs';

export const autenticarJWT = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader) return res.sendStatus(401)

  const token = authHeader.split(' ')[1]

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) return res.sendStatus(403)

    req.usuario = usuario;
    req.authContext = {
      id: usuario.id,
      cod_casal: usuario.cod_casal,
      id_parceiro: usuario.id_parceiro ?? null,
    };

    if (req.authContext.cod_casal) {
      req.headers.auth = String(req.authContext.cod_casal);
      req.headers.casal = String(req.authContext.cod_casal);

      if (req.body && typeof req.body === 'object') {
        req.body.auth = req.authContext.cod_casal;
        req.body.casal = req.authContext.cod_casal;
        req.body.cod_casal = req.authContext.cod_casal;
      }

      if (req.query && typeof req.query === 'object') {
        req.query.auth = String(req.authContext.cod_casal);
        req.query.casal = String(req.authContext.cod_casal);
        req.query.cod_casal = String(req.authContext.cod_casal);
      }
    }

    if (req.authContext.id) {
      req.headers.usuario = String(req.authContext.id);
      req.headers.iduser = String(req.authContext.id);
      req.headers.idUser = String(req.authContext.id);

      if (req.body && typeof req.body === 'object') {
        req.body.usuario = req.authContext.id;
        req.body.idUser = req.authContext.id;
      }

      if (req.query && typeof req.query === 'object') {
        req.query.usuario = String(req.authContext.id);
        req.query.idUser = String(req.authContext.id);
      }
    }

    if (req.authContext.id_parceiro) {
      if (req.query && typeof req.query === 'object') {
        req.query.parceiro = String(req.authContext.id_parceiro);
      }

      if (req.body && typeof req.body === 'object') {
        req.body.parceiro = req.authContext.id_parceiro;
      }
    }

    next();
  });
}

export const createToken = (payload, expiresIn) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn || JWT_EXPIRES })
}
