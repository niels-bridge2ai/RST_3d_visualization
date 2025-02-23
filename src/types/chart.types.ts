export interface CapacityData {
  resourceGroupId: string;
  dailyCapacities: number[];
}

export interface ChartState {
  selectedGroup: string | null;
  selectedDay: number | null;
  selectedSubValue: string | null;
  opacity: number;
} 