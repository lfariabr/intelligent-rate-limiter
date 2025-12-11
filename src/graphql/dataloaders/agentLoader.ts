import DataLoader from 'dataloader';
import redisClient from '../../db/redis';

export const agentLoader = new DataLoader<string, any>(async (ids) => {
  const results = await Promise.all(
    ids.map(async (id) => {
      const data = await redisClient.hgetall(`agent:${id}`);
      if (!data || Object.keys(data).length === 0) return null;
      return {
        id,
        name: data.name,
        tier: data.tier,
      };
    })
  );
  return results;
});

export const quotaLoader = new DataLoader<string, any>(async (agentIds) => {
  const results = await Promise.all(agentIds.map(async (id) => {
    const q = await redisClient.hgetall(`quota:${id}`);
    return {
      requestsPerMinute: parseInt(q.requestsPerMinute || '0', 10),
      requestsPerHour: parseInt(q.requestsPerHour || '0', 10),
      dailyEnergyLimit: parseFloat(q.dailyEnergyLimit || '0'),
      resetTime: q.resetTime || new Date().toISOString(),
    };
  }));
  return results;
});

export const auditLoader = new DataLoader<string, any[]>(async (agentIds) => {
  const results = await Promise.all(agentIds.map(async (id) => {
    const raw = await redisClient.lrange(`audit:${id}`, 0, 100);
    return raw.map((r: string) => JSON.parse(r));
  }));
  return results;
});
