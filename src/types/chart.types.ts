export interface CapacityData {
  resourceGroupId: string;
  dailyCapacities: number[];
}

export interface JobData {
  Job: number;
  Opr: number;
  resourceGroupId: string;
  "Planned Start Date": string;
  "Scheduled Start Date"?: string;
  "StandardProcessTime (hr)": number;
  "Scheduled Multi-day Breakdown"?: number[];
  "Planned Multi-day Breakdown"?: number[];
}

export interface JobUsage {
  usage: number;
  operation: number;
  processTime: number;
}

export interface DailyData {
  date: string;
  availableCapacity: number;
  plannedCapacity: number;
  scheduledCapacity: number;
  utilization: number;
  jobUsage: Record<number, JobUsage>;
}

export interface ViewOptions {
  showAvailableCapacity: boolean;
  showCapacity: boolean;
  showJobUsage: boolean;
  useScheduled: boolean;
}

export interface ChartState {
  selectedGroup: string | null;
  selectedDay: number | null;
  selectedSubValue: string | null;
  opacity: number;
} 