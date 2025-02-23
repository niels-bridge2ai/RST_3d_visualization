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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  selectedGroup: string | null
  resourceGroups: string[]
}>()

const emit = defineEmits<{
  'update:selectedGroup': [value: string | null],
  'bottleneckView': [],
  'trendView': [],
  'threeDView': []
}>()

const localSelectedGroup = computed({
  get: () => props.selectedGroup,
  set: (value) => emit('update:selectedGroup', value)
})
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
</style> 