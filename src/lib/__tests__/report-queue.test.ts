import { describe, it, expect, vi } from "vitest";
import { reportQueue } from "@/lib/report-queue";

describe("reportQueue background task queue", () => {
  it("enqueues and processes jobs sequentially using configured handler", async () => {
    const mockHandler = vi.fn().mockImplementation(async (job) => {
      return `/downloads/out-${job.id}.${job.format}`;
    });

    reportQueue.setHandler(mockHandler);

    const job = reportQueue.enqueue(1, "گزارش ماهانه", "manovr", "pdf");
    expect(job.status).toBe("pending");
    expect(job.format).toBe("pdf");

    // Wait for event loop ticks to process next job
    await new Promise((r) => setTimeout(r, 50));

    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({ id: job.id }));
    expect(job.status).toBe("completed");
    expect(job.outputPath).toContain("out-");
  });

  it("handles handler failure gracefully without stopping queue processing", async () => {
    reportQueue.setHandler(async () => {
      throw new Error("خطا در سیستم رندر PDF");
    });

    const job = reportQueue.enqueue(2, "گزارش خرابی", "train", "excel");
    await new Promise((r) => setTimeout(r, 50));

    expect(job.status).toBe("failed");
    expect(job.error).toContain("خطا در سیستم رندر PDF");
  });
});
