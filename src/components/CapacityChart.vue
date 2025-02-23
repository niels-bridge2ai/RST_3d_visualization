<template>
  <div class="chart-container">
    <!-- Always show the upload buttons -->
    <div class="action-buttons">
      <label 
        for="operation-upload" 
        class="icon-button"
        title="Upload Operations"
      >
        <i class="fa-solid fa-file-import"></i>
      </label>
      <label 
        for="capacity-upload" 
        class="icon-button"
        title="Upload Capacity"
      >
        <i class="fa-solid fa-calendar-plus"></i>
      </label>
      <button 
        class="icon-button"
        @click="clearData"
        title="Clear"
      >
        <i class="fa-solid fa-trash"></i>
      </button>
      <button 
        class="icon-button"
        @click="downloadData"
        title="Download"
      >
        <i class="fa-solid fa-download"></i>
      </button>
      <button 
        class="icon-button"
        @click="runScenario"
        title="Run Scenario"
      >
        <i class="fa-solid fa-play"></i>
      </button>
    </div>

    <!-- File inputs -->
    <input 
      type="file" 
      id="operation-upload" 
      accept=".xlsx,.xls"
      @change="handleOperationFileUpload"
      class="hidden"
    />
    <input 
      type="file" 
      id="capacity-upload" 
      accept=".xlsx,.xls"
      @change="handleCapacityFileUpload"
      class="hidden"
    />

    <!-- Loading message -->
    <div v-if="!hasOperationData || !hasCapacityData" class="loading">
      Please upload both operation and capacity data
    </div>

    <!-- Chart content -->
    <template v-else>
      <ChartControls 
        v-model:startDate="startDate"
        v-model:endDate="endDate"
        v-model:selectedGroup="selectedGroup"
        v-model:selectedJob="selectedJob"
        v-model:viewOptions="viewOptions"
        :resourceGroups="resourceGroups"
        :uniqueJobs="uniqueJobs"
        @bottleneckView="setView('bottleneck')"
        @trendView="setView('trend')"
        @threeDView="setView('3d')"
      />
      <ThreeScene
        ref="threeScene"
        :data="capacityData"
        :jobData="jobData"
        :selectedGroup="selectedGroup"
        :selectedJob="selectedJob"
        :viewOptions="viewOptions"
        :startDate="startDate"
        :endDate="endDate"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useChartData } from '@/composables/useChartData'
import ThreeScene from './ThreeScene.vue'
import ChartControls from './ChartControls.vue'
import type { ViewOptions } from '@/types/chart.types'
import * as XLSX from 'xlsx'

const threeScene = ref<InstanceType<typeof ThreeScene>>()
const { 
  data: capacityData, 
  jobs: jobData, 
  resourceGroups,
  updateOperationData,
  updateCapacityData 
} = useChartData()

// Track data loading state
const hasOperationData = computed(() => jobData.value.length > 0)
const hasCapacityData = computed(() => capacityData.value.length > 0)

const selectedGroup = ref<string | null>(null)
const selectedJob = ref<string | null>(null)
const viewOptions = ref<ViewOptions>({
  showAvailableCapacity: true,
  showCapacity: false,
  showJobUsage: false,
  useScheduled: false
})

const startDate = ref('2025-02-24')
const endDate = ref('2025-03-17')

// Compute unique jobs from jobData
const uniqueJobs = computed(() => {
  return [...new Set(jobData.value.map(job => job.Job))]
})

const setView = (view: '3d' | 'bottleneck' | 'trend') => {
  threeScene.value?.setOrthographicView(view)
}

// Add file handlers
const handleOperationFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      console.log('Operation data loaded:', jsonData)
      updateOperationData(jsonData)
    } catch (error) {
      console.error('Error reading operations Excel file:', error)
    }
    (event.target as HTMLInputElement).value = ''
  }
}

const handleCapacityFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      console.log('Capacity data loaded:', jsonData)
      updateCapacityData(jsonData)
    } catch (error) {
      console.error('Error reading capacity Excel file:', error)
    }
    (event.target as HTMLInputElement).value = ''
  }
}

const clearData = () => {
  // TODO: Implement clear
}

const downloadData = () => {
  // TODO: Implement download
}

const runScenario = () => {
  // TODO: Implement run
}

// Watch for data changes
watch([capacityData, jobData], ([newCapacity, newJobs], [oldCapacity, oldJobs]) => {
  console.log('Data changed:', {
    capacityData: {
      old: oldCapacity?.length,
      new: newCapacity?.length,
      data: newCapacity
    },
    jobData: {
      old: oldJobs?.length,
      new: newJobs?.length,
      data: newJobs
    }
  })

  // Force ThreeScene to update when data changes
  if (threeScene.value && hasOperationData.value && hasCapacityData.value) {
    console.log('Triggering ThreeScene update')
    threeScene.value.setOrthographicView('3d')  // Reset view to trigger redraw
  }
}, { deep: true, immediate: true })
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
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-buttons {
  position: absolute;
  top: 20px;
  right: 40px;
  display: flex;
  gap: 12px;
  z-index: 1000;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: white;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.icon-button:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.15);
}

.icon-button i {
  font-size: 14px;
}

.hidden {
  display: none;
}
</style> 