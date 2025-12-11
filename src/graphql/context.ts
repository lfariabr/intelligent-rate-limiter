import { verifyJWT } from '../utils/jwt';
import { agentLoader } from './dataloaders/agentLoader';
import { PubSub } from 'graphql-subscriptions';
import redisClient from '../db/redis';

const pubsub = new PubSub();

export async function createContext({ req }: any) {
  const auth = req?.headers?.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  let user = null;
  if (token) {
    try {
      user = verifyJWT(token);
    } catch (e) {
    }
  }

  const services = {
    requestAccess: async (agentId: string, action: string) => {
      return { allowed: true, reason: 'stub' };
    },
    overrideQuota: async (agentId: string, amount: number) => {
      return { requestsPerMinute: amount, requestsPerHour: amount * 60, resetTime: new Date().toISOString() };
    },
  };

  return {
    user,
    loaders: { agentLoader },
    services,
    pubsub,
    redis: redisClient,
  };
}
