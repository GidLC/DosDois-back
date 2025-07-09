import jwt from 'jsonwebtoken';
import { JWT_EXPIRES, JWT_SECRET } from '../data/apiConfig.mjs';

export const autenticarJWT = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) return res.sendStatus(401)

    const token = authHeader.split(' ')[1]

    jwt.verify(token, JWT_SECRET, (err, usuario) => {
        if (err) return res.sendStatus(403)

        req.usuario = usuario;
        next();
    });
}

export const createToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES
  })
}
