import { makeExecutableSchema } from '@graphql-tools/schema';
import { gql } from 'graphql-tag';
import resolvers from './resolvers';

export const typeDefs = gql`
  scalar JSON
  enum TierLevel {
    RESEARCH
    EDUCATION
    NONPROFIT
    STARTUP
    ENTERPRISE
  }

  type Agent {
    id: ID!
    name: String!
    tier: TierLevel!
    quotas: QuotaAllocation!
    currentUsage: UsageMetrics!
    carbonFootprint: Float
    auditTrail(limit: Int = 20): [AuditEntry!]!
  }

  type QuotaAllocation {
    requestsPerMinute: Int!
    requestsPerHour: Int!
    dailyEnergyLimit: Float
    escalationsAvailable: Int
    resetTime: String!
  }

  type UsageMetrics {
    requestsLastMinute: Int!
    requestsLastHour: Int!
    tokensConsumed: Int!
  }

  type AuditEntry {
    timestamp: String!
    endpoint: String!
    result: String!
    tokens: Int
    metadata: JSON
  }

  type ThrottlingDecision {
    allowed: Boolean!
    reason: String
    estimatedWaitTime: Int
    nextAvailableSlot: String
  }

  input RequestAccessInput {
    agentId: ID!
    action: String!
  }

  type Query {
    serverVersion: String!
    agent(id: ID!): Agent
    quota(agentId: ID!): QuotaAllocation
  }

  type Mutation {
    requestAccess(input: RequestAccessInput!): ThrottlingDecision!
    requestOverride(agentId: ID!, amount: Int!): QuotaAllocation!
  }

  type Subscription {
    quotaUpdates(agentId: ID!): QuotaAllocation!
  }
`;

export const schema = makeExecutableSchema({ typeDefs, resolvers });
