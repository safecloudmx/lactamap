import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getPartnership } from './partnerships';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

let io: Server | null = null;

/** Map userId → Set of socket IDs (a user may have multiple tabs/devices) */
const userSockets = new Map<string, Set<string>>();

/** Map socketId → userId for reverse lookup */
const socketUser = new Map<string, string>();

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:19000'],
      credentials: true,
    },
    path: '/ws',
  });

  // JWT auth middleware — runs once on handshake
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId: string = (socket as any).userId;

    // Track socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);
    socketUser.set(socket.id, userId);

    // Join partnership room so partner events reach this socket
    const partnership = await getPartnership(userId);
    if (partnership) {
      socket.join(`partnership:${partnership.id}`);
    }

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
      socketUser.delete(socket.id);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

/**
 * Emit a timer event to the partner of a given user.
 * Sends to all sockets in the partnership room EXCEPT the sender's own sockets.
 */
export async function emitToPartner(userId: string, event: string, data: any) {
  if (!io) return;
  const partnership = await getPartnership(userId);
  if (!partnership) return;

  const room = `partnership:${partnership.id}`;
  const mySockets = userSockets.get(userId);

  // Build a broadcast that excludes ALL of the caller's sockets
  let broadcast = io.to(room);
  if (mySockets) {
    for (const sid of mySockets) {
      broadcast = broadcast.except(sid);
    }
  }
  broadcast.emit(event, data);
}
