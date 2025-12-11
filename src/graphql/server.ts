import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { schema } from './schema';
import { createContext } from './context';
import { applyWebsocketServer } from './subscriptions';

export async function startGraphqlServer({ port = 4000 } = {}) {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema,
  });

  await server.start();

  app.use(cors());
  app.use('/graphql', bodyParser.json(), expressMiddleware(server, { context: createContext }));

  applyWebsocketServer({ httpServer, schema });

  await new Promise<void>((resolve: any) => httpServer.listen({ port }, resolve));
  console.log(`🚀 GraphQL server ready at http://localhost:${port}/graphql`);
}
