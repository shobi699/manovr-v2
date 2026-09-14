/**
 * Distribution and Network Simulation Types
 * Generated for 003-packaging-network-resilience
 */

export interface NetworkSimulationConfig {
  sharedFolderPath: string;        // Virtual simulated network folder path
  simulatedMinPingMs: number;      // Minimum artificial ping delay (e.g., 100ms)
  simulatedMaxPingMs: number;      // Maximum artificial ping delay (e.g., 800ms)
  jitterEnabled: boolean;          // Random jitter variance in ping
  simulatedDropRate: number;       // High delay rate (0 to 1)
  concurrentClientsCount: number;  // Number of concurrent simulated clients (e.g. 10)
  totalTransactionsPerClient: number; // Transactions per client
}

export interface StressTestResult {
  executionDate: string;           // Date & time in Tehran timezone
  totalClients: number;            // Number of concurrent client workers
  totalOperations: number;         // Total attempted operations
  successfulOperations: number;    // Successfully committed operations
  failedOperations: number;        // Failed operations
  retryCountTotal: number;         // Total queue retries
  averageLatencyMs: number;        // Average operation latency
  maxLatencyMs: number;            // Maximum latency
  busyLockErrors: number;          // SQLite busy lock errors (must be 0)
  persistenceVerified: boolean;    // Proof that data was written and read back
  status: "PASSED" | "FAILED";
}

export interface DistributionArtifact {
  format: "PORTABLE" | "INSTALLER" | "UNPACKED_DIR" | "USER_GUIDE";
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256Hash?: string;
  verifiedExecutable: boolean;
}

export interface DistributionManifest {
  manifestId: string;
  productName: string;
  version: string;
  buildDateJalali: string;
  distributionDirectory: string;   // D:/manovr-build-dist
  artifacts: DistributionArtifact[];
  systemRequirements: {
    os: string;
    architecture: string;
    minRam: string;
    networkShareCompatible: boolean;
  };
}
