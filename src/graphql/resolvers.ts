import { agentLoader, quotaLoader, auditLoader } from './dataloaders/agentLoader';
import { pubsub } from './subscriptions';

const resolvers = {
  Query: {
    serverVersion: () => 'irl-graphql-v1',
    agent: async (_: unknown, { id }: { id: string }) => {
      return agentLoader.load(id);
    },
    quota: async (_: unknown, { agentId }: { agentId: string }) => {
      return quotaLoader.load(agentId);
    },
  },
  Mutation: {
    requestAccess: async (_: unknown, { input }: any, ctx: any) => {
      const { agentId, action } = input;
      const decision = await ctx.services.requestAccess(agentId, action);
      if (!decision.allowed) {
        pubsub.publish(`quota:${agentId}`, decision);
      }
      return decision;
    },
    requestOverride: async (_: unknown, { agentId, amount }: any, ctx: any) => {
      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new Error('Not authorized');
      }
      const newQuota = await ctx.services.overrideQuota(agentId, amount);
      pubsub.publish(`quota:${agentId}`, newQuota);
      return newQuota;
    },
  },
  Subscription: {
    quotaUpdates: {
      subscribe: (_: unknown, { agentId }: any, ctx: any) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return ctx.pubsub.asyncIterator(`quota:${agentId}`);
      },
    },
  },
  Agent: {
    quotas: (parent: any) => quotaLoader.load(parent.id),
    currentUsage: (parent: any) => ({
      /* map usage from storage */
    }),
    auditTrail: (parent: any, { limit = 20 }: any) =>
      auditLoader.load(parent.id).then((arr) => arr.slice(0, limit)),
  },
};

export default resolvers;
