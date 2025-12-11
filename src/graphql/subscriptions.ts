import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { execute, subscribe } from 'graphql';
import { schema } from './schema';
import { createContext } from './context';
import { PubSub } from 'graphql-subscriptions';
import { verifyJWT } from '../utils/jwt';

export const pubsub = new PubSub();

export function applyWebsocketServer({ httpServer, schema }: { httpServer: any; schema: any }) {
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  useServer(
    {
      schema,
      execute,
      subscribe,
      onConnect: async (ctx: any) => {
      },
      context: async (ctx: any, msg: any, args: any) => {
        const token = ctx.connectionParams?.authorization?.replace(/^Bearer\s+/i, '');
        let user = null;
        if (token) {
          try {
            user = verifyJWT(token);
          } catch (e) {}
        }
        return { user, pubsub };
      },
    },
    wsServer
  );

  console.log('WebSocket subscriptions ready at /graphql (ws)');
}
