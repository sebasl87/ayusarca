import { Queue } from "bullmq";
import Redis from "ioredis";

import { getServerEnv } from "@/lib/env";

let cachedConnection: Redis | null = null;

export function getRedisConnection() {
  if (cachedConnection) return cachedConnection;
  const redisUrl = getServerEnv().REDIS_URL;
  if (!redisUrl) throw new Error("Missing REDIS_URL");
  cachedConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return cachedConnection;
}

export function getQueue(name: string) {
  return new Queue(name, { connection: getRedisConnection() });
}

