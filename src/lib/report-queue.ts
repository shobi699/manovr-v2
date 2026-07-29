/**
 * ماژول صف پس‌زمینه پردازش و رندر گزارش‌های زمان‌بندی‌شده و سنگین.
 * مانع از کندی یا بلاک شدن ترد اصلی برنامه (Main Event Loop) می‌گردد.
 */

export interface ReportJob {
  id: string;
  reportId: number;
  reportName: string;
  entity: string;
  format: "excel" | "pdf";
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  outputPath?: string;
}

export type JobHandler = (job: ReportJob) => Promise<string>;

class ReportQueueManager {
  private queue: ReportJob[] = [];
  private isProcessing = false;
  private handler: JobHandler | null = null;
  private listeners: Array<(job: ReportJob) => void> = [];

  setHandler(handler: JobHandler) {
    this.handler = handler;
  }

  onJobCompleted(listener: (job: ReportJob) => void) {
    this.listeners.push(listener);
  }

  enqueue(reportId: number, reportName: string, entity: string, format: "excel" | "pdf"): ReportJob {
    const job: ReportJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      reportId,
      reportName,
      entity,
      format,
      status: "pending",
      createdAt: new Date(),
    };

    this.queue.push(job);
    process.nextTick(() => this.processNext());
    return job;
  }

  getJobs(): ReportJob[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.filter((j) => j.status === "pending").length;
  }

  private async processNext() {
    if (this.isProcessing || !this.handler) return;

    const nextJob = this.queue.find((j) => j.status === "pending");
    if (!nextJob) return;

    this.isProcessing = true;
    nextJob.status = "processing";
    nextJob.startedAt = new Date();

    try {
      const outputPath = await this.handler(nextJob);
      nextJob.status = "completed";
      nextJob.outputPath = outputPath;
      nextJob.completedAt = new Date();
    } catch (err: unknown) {
      nextJob.status = "failed";
      nextJob.error = err instanceof Error ? err.message : String(err);
      nextJob.completedAt = new Date();
    } finally {
      this.isProcessing = false;
      this.listeners.forEach((fn) => fn(nextJob));
      process.nextTick(() => this.processNext());
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter((j) => j.status === "pending" || j.status === "processing");
  }
}

export const reportQueue = new ReportQueueManager();
