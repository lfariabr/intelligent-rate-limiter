import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// After the check above, JWT_SECRET is guaranteed to be a string
const secret: string = JWT_SECRET;

export interface JWTPayload {
  userId: string;
  role?: string;
  [key: string]: any;
}

export function signJWT(payload: JWTPayload, expiresIn: string | number = '24h'): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, secret) as JWTPayload;
}
