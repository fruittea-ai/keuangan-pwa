import { createTransaction, createTransfer, createBudget } from "./api";
import { getQueue, removeFromQueue } from "./storage";

let syncing = false;

export async function syncQueue() {
  if (syncing || !navigator.onLine) {
    return { synced: 0, pending: getQueue().length };
  }

  syncing = true;
  let synced = 0;

  try {
    const queue = [...getQueue()];

    for (const item of queue) {
      try {
        const {
          local_id,
          queued_at,
          action = "create_transaction",
          ...payload
        } = item;

        if (action === "create_transfer") {
          await createTransfer(payload);
        } else if (action === "upsert_budget") {
          await createBudget(payload);
        } else {
          await createTransaction(payload);
        }

        removeFromQueue(local_id);
        synced += 1;
      } catch {
        // Preserve order. Retry the first failed item later.
        break;
      }
    }
  } finally {
    syncing = false;
  }

  return {
    synced,
    pending: getQueue().length
  };
}
