<template>
  <div class="chart-container">
    <div v-if="loading" class="loading">
      Loading visualization...
    </div>
    <template v-else>
      <ChartControls 
        v-model:selectedGroup="selectedGroup"
        :resource-groups="resourceGroups"
        @bottleneck-view="() => threeScene?.setOrthographicView('bottleneck')"
        @trend-view="() => threeScene?.setOrthographicView('trend')"
        @three-d-view="() => threeScene?.setOrthographicView('3d')"
      />
      <ThreeScene 
        ref="threeScene"
        :data="chartData"
        :selected-group="selectedGroup"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useChartData } from '@/composables/useChartData'
import ThreeScene from './ThreeScene.vue'
import ChartControls from './ChartControls.vue'

const threeScene = ref<InstanceType<typeof ThreeScene>>()
const { data: chartData, loadData, resourceGroups } = useChartData()
const selectedGroup = ref<string | null>(null)
const loading = ref(true)

const handleTopView = () => {
  threeScene.value?.setTopView()
}

onMounted(async () => {
  try {
    await loadData()
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