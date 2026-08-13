const QUEUE_KEY = "keuangan_sync_queue_v1";
const CACHE_PREFIX = "keuangan_cache_v1:";

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getQueue() {
  return read(QUEUE_KEY, []);
}

export function addToQueue(item) {
  const queue = getQueue();
  const queued = {
    local_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    queued_at: new Date().toISOString(),
    action: item.action || "create_transaction",
    ...item
  };
  queue.push(queued);
  write(QUEUE_KEY, queue);
  return queued;
}

export function removeFromQueue(localId) {
  write(QUEUE_KEY, getQueue().filter(item => item.local_id !== localId));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function setCache(name, data) {
  write(`${CACHE_PREFIX}${name}`, {
    cached_at: new Date().toISOString(),
    data
  });
}

export function getCache(name, fallback = null) {
  return read(`${CACHE_PREFIX}${name}`, fallback)?.data ?? fallback;
}
