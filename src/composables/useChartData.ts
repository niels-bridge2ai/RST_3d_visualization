import { ref, computed } from 'vue'
import type { CapacityData } from '@/types/chart.types'
import capacityData from '@/assets/data/capacity-data.json'

export function useChartData() {
  const data = ref<CapacityData[]>([])
  
  const loadData = async () => {
    data.value = capacityData.data
    return data.value
  }

  const resourceGroups = computed(() => 
    data.value.map((item: CapacityData) => item.resourceGroupId)
  )

  const maxCapacity = computed(() => 
    Math.max(...data.value.flatMap((item: CapacityData) => item.dailyCapacities))
  )

  return {
    data,
    loadData,
    resourceGroups,
    maxCapacity
  }
} 