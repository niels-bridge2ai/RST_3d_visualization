<template>
  <div class="mapping-overlay" v-show="showMapping">
    <div class="mapping-form">
      <h2>Map Excel Columns</h2>
      
      <div class="column-mappings">
        <div class="mapping-row" v-for="(field, index) in requiredFields" :key="field.key">
          <label>{{ field.label }}*</label>
          <select v-model="mappings[field.key]">
            <option value="">Select Column</option>
            <option 
              v-for="column in excelColumns" 
              :key="column"
              :value="column"
            >
              {{ column }}
            </option>
          </select>
        </div>

        <div class="mapping-row" v-for="(field, index) in optionalFields" :key="field.key">
          <label>{{ field.label }}</label>
          <select v-model="mappings[field.key]">
            <option value="">Select Column (Optional)</option>
            <option 
              v-for="column in excelColumns" 
              :key="column"
              :value="column"
            >
              {{ column }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button class="cancel-btn" @click="cancel">Cancel</button>
        <button 
          class="import-btn" 
          @click="importData"
          :disabled="!isValid"
        >
          Import Data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import * as XLSX from 'xlsx'

const props = defineProps<{
  showMapping: boolean
  excelColumns: string[]
  excelData: any[]
  mappingType: 'operation' | 'capacity'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'import', data: any[]): void
}>()

const requiredFields = computed(() => {
  if (props.mappingType === 'operation') {
    return [
      { key: 'Job', label: 'Job ID' },
      { key: 'Part', label: 'Part Number' },
      { key: 'resourceGroupId', label: 'Resource Group' },
      { key: 'Opr', label: 'Operation' },
      { key: 'Prod. Qty', label: 'Quantity' },
      { key: 'StandardProcessTime (hr)', label: 'Process Time (hrs)' },
      { key: 'Job Complete Qty', label: 'Completed Quantity' },
      { key: 'FinalOp', label: 'Final Operation' },
      { key: 'Planned Start Date', label: 'Planned Start Date' },
      { key: 'Planned Due Date', label: 'Planned Due Date' },
    ]
  } else {
    // For capacity data, no validation needed
    return []
  }
})

const optionalFields = [
  { key: 'Scheduled Start Date', label: 'Scheduled Start Date' },
  { key: 'Scheduled Completion Date', label: 'Scheduled Completion Date' },
  { key: 'Scheduled Multi-day Breakdown', label: 'Scheduled Daily Breakdown' },
  { key: 'Planned Multi-day Breakdown', label: 'Planned Daily Breakdown' },
]

const mappings = ref<Record<string, string>>({})

// Auto-map columns if they match field names
const initializeMappings = () => {
  props.excelColumns.forEach(column => {
    const matchingRequired = requiredFields.value.find(
      field => field.key.toLowerCase() === column.toLowerCase()
    )
    const matchingOptional = optionalFields.find(
      field => field.key.toLowerCase() === column.toLowerCase()
    )
    if (matchingRequired) {
      mappings.value[matchingRequired.key] = column
    }
    if (matchingOptional) {
      mappings.value[matchingOptional.key] = column
    }
  })
}

// Watch for changes in excelColumns
watch(() => props.excelColumns, initializeMappings, { immediate: true })

const isValid = computed(() => {
  if (props.mappingType === 'operation') {
    return requiredFields.value.every(field => mappings.value[field.key])
  }
  return true
})

const importData = () => {
  if (props.mappingType === 'operation') {
    const mappedData = props.excelData.map(row => {
      const newRow: Record<string, any> = {}
      
      // Map required fields
      requiredFields.value.forEach(field => {
        newRow[field.key] = row[mappings.value[field.key]]
      })
      
      // Map optional fields if they exist
      optionalFields.forEach(field => {
        if (mappings.value[field.key]) {
          newRow[field.key] = row[mappings.value[field.key]]
        }
      })
      
      return newRow
    })
    emit('import', mappedData)
  } else {
    // For capacity data, assume fixed column order
    const mappedData = props.excelData.map(row => {
      const values = Object.values(row)
      return {
        resourceGroupId: values[0],
        dailyCapacities: [
          Number(values[1]) || 24, // Sunday
          Number(values[2]) || 24, // Monday
          Number(values[3]) || 24, // Tuesday
          Number(values[4]) || 24, // Wednesday
          Number(values[5]) || 24, // Thursday
          Number(values[6]) || 24, // Friday
          Number(values[7]) || 24  // Saturday
        ]
      }
    })
    emit('import', mappedData)
  }
}

const cancel = () => {
  emit('close')
}
</script>

<style scoped>
.mapping-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.mapping-form {
  background: white;
  padding: 24px;
  border-radius: 8px;
  min-width: 400px;
  max-width: 600px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

h2 {
  margin: 0 0 20px 0;
  color: #333;
}

.column-mappings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.mapping-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

label {
  flex: 1;
  color: #666;
}

select {
  flex: 2;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.import-btn {
  background: #4CAF50;
  color: white;
}

.import-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-btn:hover {
  background: #eee;
}

.import-btn:not(:disabled):hover {
  background: #45a049;
}
</style> 