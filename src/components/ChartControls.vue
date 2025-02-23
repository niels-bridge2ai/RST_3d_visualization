<template>
  <div class="controls-container">
    <div class="control-group">
      <label for="resource-select">Resource Group:</label>
      <select 
        id="resource-select"
        v-model="localSelectedGroup"
        class="select-input"
      >
        <option value="">All Groups</option>
        <option 
          v-for="group in resourceGroups" 
          :key="group" 
          :value="group"
        >
          {{ group }}
        </option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="job-select">Job:</label>
      <select 
        id="job-select"
        v-model="localSelectedJob"
        class="select-input"
      >
        <option value="">All Jobs</option>
        <option 
          v-for="job in uniqueJobs" 
          :key="job" 
          :value="job"
        >
          {{ job }}
        </option>
      </select>
    </div>

    <div class="control-group">
      <label for="schedule-type">Schedule Type:</label>
      <select 
        id="schedule-type"
        v-model="useScheduled"
        class="select-input"
      >
        <option :value="false">Planned</option>
        <option :value="true">Scheduled</option>
      </select>
    </div>

    <div class="control-group">
      <label>View Options:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="showAvailableCapacity"
            @change="emitViewOptions"
          >
          Available Capacity
        </label>
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="showCapacity"
            @change="emitViewOptions"
          >
          Capacity
        </label>
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="showJobUsage"
            @change="emitViewOptions"
          >
          Job Usage
        </label>
      </div>
    </div>

    <div class="control-group">
      <button 
        class="view-button"
        @click="$emit('bottleneckView')"
      >
        Bottleneck View
      </button>
      <button 
        class="view-button"
        @click="$emit('trendView')"
      >
        Trend View
      </button>
      <button 
        class="view-button"
        @click="$emit('threeDView')"
      >
        3D View
      </button>
    </div>

    <div class="date-range">
      <div class="date-input">
        <label>Start Date:</label>
        <input 
          type="date" 
          :value="startDate" 
          @input="updateStartDate"
          :min="minDate"
          :max="maxDate"
        />
      </div>
      <div class="date-input">
        <label>End Date:</label>
        <input 
          type="date" 
          :value="endDate" 
          @input="updateEndDate"
          :min="startDate"
          :max="maxDate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  selectedGroup: string | null
  selectedJob: string | null
  resourceGroups: string[]
  jobData: any[] // We'll type this properly later
  startDate: string
  endDate: string
}>()

const emit = defineEmits<{
  'update:selectedGroup': [value: string | null]
  'update:selectedJob': [value: string | null]
  'bottleneckView': []
  'trendView': []
  'threeDView': []
  'viewOptionsChanged': [options: {
    showAvailableCapacity: boolean
    showCapacity: boolean
    showJobUsage: boolean
    useScheduled: boolean
  }]
  (e: 'update:startDate', value: string): void
  (e: 'update:endDate', value: string): void
}>()

const showAvailableCapacity = ref(true)
const showCapacity = ref(false)
const showJobUsage = ref(false)
const useScheduled = ref(false)

const localSelectedGroup = computed({
  get: () => props.selectedGroup,
  set: (value) => emit('update:selectedGroup', value)
})

const localSelectedJob = computed({
  get: () => props.selectedJob,
  set: (value) => emit('update:selectedJob', value)
})

const uniqueJobs = computed(() => {
  if (!props.jobData) return []
  return [...new Set(props.jobData.map(job => job.Job))]
})

const emitViewOptions = () => {
  emit('viewOptionsChanged', {
    showAvailableCapacity: showAvailableCapacity.value,
    showCapacity: showCapacity.value,
    showJobUsage: showJobUsage.value,
    useScheduled: useScheduled.value
  })
}

// Add watcher for useScheduled
watch(useScheduled, () => {
  emitViewOptions()
})

const minDate = '2025-02-24'
const maxDate = '2025-03-17'

const updateStartDate = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:startDate', value)
}

const updateEndDate = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit('update:endDate', value)
}
</script>

<style scoped>
.controls-container {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.control-group {
  margin-bottom: 15px;
}

.control-group:last-child {
  margin-bottom: 0;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.select-input {
  width: 200px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.view-button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
}

.view-button:last-child {
  margin-right: 0;
}

.view-button:hover {
  background-color: #45a049;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.date-range {
  display: flex;
  gap: 20px;
}

.date-input {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

label {
  font-size: 14px;
  color: #666;
}

input[type="date"] {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style> 