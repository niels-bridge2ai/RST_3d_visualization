<template>
  <div class="chart-container">
    <div v-if="loading" class="loading">
      Loading visualization...
    </div>
    <template v-else>
      <ChartControls 
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:selectedGroup="selectedGroup"
        v-model:selectedJob="selectedJob"
        :resource-groups="resourceGroups"
        :job-data="jobs"
        @bottleneck-view="() => threeScene?.setOrthographicView('bottleneck')"
        @trend-view="() => threeScene?.setOrthographicView('trend')"
        @three-d-view="() => threeScene?.setOrthographicView('3d')"
        @view-options-changed="handleViewOptionsChanged"
      />
      <ThreeScene 
        ref="threeScene"
        :data="data"
        :jobData="jobs"
        :selected-group="selectedGroup"
        :selected-job="selectedJob"
        :view-options="viewOptions"
        :start-date="startDate"
        :end-date="endDate"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useChartData } from '../composables/useChartData'
import ThreeScene from './ThreeScene.vue'
import ChartControls from './ChartControls.vue'
import type { ViewOptions } from '@/types/chart.types'

const threeScene = ref<InstanceType<typeof ThreeScene>>()
const { data, jobs, initializeData, resourceGroups } = useChartData()
const selectedGroup = ref<string | null>(null)
const selectedJob = ref<string | null>(null)
const loading = ref(true)
const viewOptions = ref<ViewOptions>({
  showAvailableCapacity: true,
  showCapacity: false,
  showJobUsage: false,
  useScheduled: false
})

const startDate = ref('2025-02-24')
const endDate = ref('2025-03-17')

const handleViewOptionsChanged = (options: ViewOptions) => {
  viewOptions.value = options
}

onMounted(() => {
  try {
    initializeData()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: #666;
}
</style> 