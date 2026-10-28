import { describeJobQueueContract } from "../../ports/job-queue.contract";
import { createMemoryJobQueue } from "./memory-job-queue";

describeJobQueueContract("createMemoryJobQueue", () => {
  const queue = createMemoryJobQueue();
  return {
    queue,
    sent: () =>
      queue.sent.map(({ envelope, delaySeconds }) => ({
        envelope,
        delaySeconds,
      })),
  };
});
