<template>
  <div ref="container" class="three-container">
    <!-- Update scenario buttons -->
    <div class="action-buttons">
      <label 
        for="excel-upload" 
        class="icon-button"
        title="Upload Excel"
      >
        <span class="material-icons">upload</span>
      </label>
      <button 
        class="icon-button"
        @click="clearScenario"
        title="Clear"
      >
        <span class="material-icons">clear</span>
      </button>
      <button 
        class="icon-button"
        @click="commitScenario"
        title="Download"
      >
        <span class="material-icons">download</span>
      </button>
    </div>

    <input 
      type="file" 
      id="excel-upload" 
      accept=".xlsx,.xls"
      @change="handleFileUpload"
      class="hidden"
    />

    <!-- Add color legend -->
    <div class="color-legend">
      <div class="legend-title">Utilization</div>
      <div class="legend-gradient"></div>
      <div class="legend-labels">
        <span>100% or more</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>
    </div>

    <!-- Three.js will render here -->
    <button 
      class="save-debug-data"
      @click="saveDebugData"
    >
      Save Debug Data
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import type { CapacityData, JobData, ViewOptions } from '@/types/chart.types'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { withDefaults } from 'vue'
import * as d3 from 'd3-scale-chromatic'
import { useChartData } from '@/composables/useChartData'

const props = withDefaults(defineProps<{
  data: CapacityData[]
  jobData: JobData[]
  selectedGroup: string | null
  selectedJob: string | null
  viewOptions: ViewOptions
  startDate: string
  endDate: string
}>(), {
  data: () => [],
  jobData: () => [],
  selectedGroup: null,
  selectedJob: null,
  viewOptions: () => ({
    showAvailableCapacity: true,
    showCapacity: false,
    showJobUsage: false,
    useScheduled: false
  }),
  startDate: '2025-02-24',
  endDate: '2025-03-17'
})

const container = ref<HTMLDivElement>()
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let bars: THREE.Group[] = []
const labelRenderer = ref<CSS2DRenderer>()
let isTopView = false
let perspectiveCamera: THREE.PerspectiveCamera
let orthographicCamera: THREE.OrthographicCamera
// NEW: Add a third camera for the "trend" view.
let trendCamera: THREE.OrthographicCamera
let currentCamera: THREE.Camera

// Add view type tracking
type ViewType = '3d' | 'bottleneck' | 'trend'
let currentView: ViewType = '3d'

// Add a constant for spacing
const SPACING = 8    // Increased from 4 to 8
const BOX_SIZE = 3   // Increased from 2 to 3

// Add after existing constants
type BarType = 'available' | 'scheduled' | 'job'

// Add utility functions
const getViridisColor = (value: number): THREE.Color => {
  // Flip the value to make yellow represent high utilization
  const colorString = d3.interpolateViridis(value)
  return new THREE.Color(colorString)
}

const generateDates = () => {
  // Create dates starting from the start date
  const start = new Date(props.startDate)
  start.setHours(0, 0, 0, 0)  // Reset time to start of day
  const end = new Date(props.endDate)
  end.setHours(0, 0, 0, 0)  // Reset time to start of day
  
  const dates: Date[] = []
  let current = new Date(start)
  
  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

const { 
  data, 
  jobs, 
  initializeData, 
  generateDebugData, 
  generateAndSaveDebugData,
  getScheduledCapacity,
  getJobCapacity 
} = useChartData()

const getWeeklyCapacity = (item: CapacityData, date: Date) => {
  // Get day of week (0-6, where 0 is Sunday)
  const dayOfWeek = date.getDay()
  // Use the first week's data and repeat it
  return item.dailyCapacities[dayOfWeek]
}

const initThreeScene = () => {
  if (!container.value) return

  // Initialize scene first
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)
  
  // Create both cameras and our new third camera
  const aspect = container.value.clientWidth / container.value.clientHeight
  const viewSize = 50
  
  perspectiveCamera = new THREE.PerspectiveCamera(
    60,
    aspect,
    0.1,
    1000
  )
  perspectiveCamera.position.set(100, 100, 100)
  
  orthographicCamera = new THREE.OrthographicCamera(
    -viewSize * aspect,
    viewSize * aspect,
    viewSize,
    -viewSize,
    1,
    1000
  )
  orthographicCamera.position.set(100, 100, 100)
  
  // NEW: Initialize the trend camera using similar parameters
  trendCamera = new THREE.OrthographicCamera(
    -viewSize * aspect,
    viewSize * aspect,
    viewSize,
    -viewSize,
    1,
    1000
  )
  // The initial position can be arbitrary; it will be updated in setOrthographicView()
  trendCamera.position.set(-100, 100, 100)
  
  // Start with perspective camera
  currentCamera = perspectiveCamera
  
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  container.value.appendChild(renderer.domElement)
  
  labelRenderer.value = new CSS2DRenderer()
  labelRenderer.value.setSize(container.value.clientWidth, container.value.clientHeight)
  labelRenderer.value.domElement.style.position = 'absolute'
  labelRenderer.value.domElement.style.top = '0'
  container.value.appendChild(labelRenderer.value.domElement)
  
  controls = new OrbitControls(currentCamera, labelRenderer.value.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
  directionalLight.position.set(10, 20, 30)
  scene.add(directionalLight)
  
  // Create new grid helper aligned with box spacing
  const gridSize = 400  // Make grid cover more area
  const divisions = Math.floor(gridSize / SPACING)  // Make grid lines match box spacing
  const gridHelper = new THREE.GridHelper(gridSize, divisions)
  
  // Center the grid to align with our boxes
  gridHelper.position.x = gridSize / 4
  gridHelper.position.z = gridSize / 4
  
  scene.add(gridHelper)
  
  // Create initial scene elements
  createAxesLabels()
  createBars()
  animate()
}

const createBars = () => {
  if (!props.data || !scene) return
  
  // Clear existing bars
  bars.forEach(bar => {
    if (bar && scene.children.includes(bar)) {
      scene.remove(bar)
    }
  })
  bars = []

  // Clear existing labels
  scene.children.forEach(child => {
    if (child instanceof CSS2DObject) {
      scene.remove(child)
    }
  })

  // Create axes and grid first
  createAxesLabels()

  const dates = generateDates()

  // Create date labels once, but position them at the same z-coordinate as their corresponding bars
  dates.forEach((date, dayIndex) => {
    const z = dayIndex + 1  // Same z-coordinate calculation as used for bars
    const newDate = new Date(date);
// Add one day
newDate.setDate(newDate.getDate() + 1);

// Create the label using the new date
const dateLabel = createLabel(newDate.toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'numeric',
  day: 'numeric'
}));
    // Position label at exactly the same z position as the bars
    dateLabel.position.set(-SPACING, 0, z * SPACING)  // Remove the +1 offset
    scene.add(dateLabel)
  })

  props.data.forEach((item, groupIndex) => {
    if (!item.resourceGroupId) return
    
    if (props.selectedGroup && item.resourceGroupId !== props.selectedGroup) return

    const groupLabel = createLabel(item.resourceGroupId)
    groupLabel.position.set((groupIndex + 1) * SPACING, 0, -SPACING)
    scene.add(groupLabel)

    dates.forEach((date, dayIndex) => {
      const x = groupIndex + 1
      const z = dayIndex + 1

      // Get weekly repeating capacity using the actual date
      const dailyCapacity = getWeeklyCapacity(item, date)

      const scheduledCapacity = getScheduledCapacity(
        item.resourceGroupId, 
        date,
        props.viewOptions.useScheduled
      )

      const isBottleneck = scheduledCapacity > dailyCapacity
      const showInBottleneckView = currentView !== 'bottleneck' || isBottleneck

      if (props.viewOptions.showAvailableCapacity && showInBottleneckView) {
        const availableBar = createBar(dailyCapacity, x, z, 'available')
        scene.add(availableBar)
        bars.push(availableBar)
      }

      if (props.viewOptions.showCapacity && scheduledCapacity > 0) {
        const utilization = Math.min(scheduledCapacity / dailyCapacity, 1)
        const scheduledBar = createBar(scheduledCapacity, x, z, 'scheduled', utilization)
        scene.add(scheduledBar)
        bars.push(scheduledBar)
      }

      // Create job usage bar if enabled
      if (props.viewOptions.showJobUsage && props.selectedJob) {
        const jobCapacity = getJobCapacity(
          Number(props.selectedJob), 
          date,
          props.viewOptions.useScheduled
        )
        if (jobCapacity > 0) {
          const jobBar = createBar(jobCapacity, x, z, 'job')
          scene.add(jobBar)
          bars.push(jobBar)
        }
      }
    })
  })
}

const createBar = (height: number, x: number, z: number, type: BarType, utilization: number = 0) => {
  const scaledHeight = Math.max(0.1, (height || 0) / 2)
  
  let geometry: THREE.BufferGeometry
  let material: THREE.Material
  
  switch (type) {
    case 'available':
      // Make the plane slightly larger than other bars
      geometry = new THREE.BoxGeometry(BOX_SIZE * 1.2, 0.1, BOX_SIZE * 1.2)
      material = new THREE.MeshPhongMaterial({
        color: 0xFF0000,
        transparent: true,
        opacity: 0.8
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x * SPACING, scaledHeight, z * SPACING)
      return mesh
      
    case 'scheduled':
      geometry = new THREE.BoxGeometry(BOX_SIZE, scaledHeight, BOX_SIZE)
      material = new THREE.MeshPhongMaterial({
        color: getViridisColor(utilization).getHex(),
        transparent: true,
        opacity: 0.8
      })
      break
      
    default:
      geometry = new THREE.BoxGeometry(BOX_SIZE, scaledHeight, BOX_SIZE)
      material = new THREE.MeshPhongMaterial({
        color: 0x2196F3,
        transparent: true,
        opacity: 0.9
      })
  }
  
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x * SPACING, scaledHeight/2, z * SPACING)
  return mesh
}

const createLabel = (text: string) => {
  const div = document.createElement('div')
  div.className = 'label plaque'
  div.textContent = text
  div.style.color = 'black'
  div.style.fontSize = '10px'
  
  return new CSS2DObject(div)
}

const createAxesLabels = () => {
  if (!props.data || props.data.length === 0) return;

  const xAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3((props.data.length + 2) * SPACING, 0, 0)  // Add 2 for padding
    ]),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
  )
  scene.add(xAxis)
  
  const zAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, (21 + 2) * SPACING)  // Add 2 for padding
    ]),
    new THREE.LineBasicMaterial({ color: 0x0000ff })
  )
  scene.add(zAxis)
  
  const yAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 40, 0)  // Height of 40 for scaled values
    ]),
    new THREE.LineBasicMaterial({ color: 0x00ff00 })
  )
  scene.add(yAxis)
  
  const addLabel = (text: string, position: THREE.Vector3) => {
    const div = document.createElement('div')
    div.className = 'label'
    div.textContent = text
    div.style.color = 'black'
    div.style.fontSize = '12px'
    
    const label = new CSS2DObject(div)
    label.position.copy(position)
    scene.add(label)
  }

  // Add capacity labels every 5 units
  for (let i = 0; i <= 40; i += 5) {
    // Convert back to original scale for the label text (multiply by 2 since we divided by 2 in createBar)
    const actualCapacity = i * 2
    addLabel(actualCapacity.toString(), new THREE.Vector3(-2, i, 0))
  }
  
  addLabel('Resource Groups →', new THREE.Vector3((props.data.length + 2) * SPACING, 0, 0))
  addLabel('Days →', new THREE.Vector3(0, 0, (21 + 2) * SPACING))
  addLabel('Capacity', new THREE.Vector3(0, 42, 0))
}

const animate = () => {
  if (!scene || !renderer || !currentCamera) {
    return
  }
  
  try {
    requestAnimationFrame(animate)
    controls?.update()
    renderer.render(scene, currentCamera)
    labelRenderer.value?.render(scene, currentCamera)
  } catch (error) {
    console.error('Animation error:', error)
  }
}

const setOrthographicView = (viewType: ViewType) => {
  if (!orthographicCamera || !perspectiveCamera || !trendCamera) return
  
  currentView = viewType
  // Adjust centers to account for the offset
  const centerX = ((props.data.length + 1) * SPACING) / 2
  const centerZ = ((21 + 1) * SPACING) / 2
  const maxHeight = 50
  
  if (viewType !== '3d') {
    if (viewType === 'bottleneck') {
      // Top-down view (x-z plane)
      currentCamera = orthographicCamera
      currentCamera.position.set(centerX, 200, centerZ)  // Higher up for better overview
      currentCamera.up.set(0, 0, -1)  // Keep Z axis pointing up in view
      currentCamera.lookAt(centerX, 0, centerZ)
      orthographicCamera.zoom = 0.4
      
      // Set controls for top view
      controls.enableRotate = false  // Lock rotation for top view
      controls.target.set(centerX, 0, centerZ)
    } else if (viewType === 'trend') {
      // Side view (looking at boxes from the side)
      currentCamera = trendCamera
      trendCamera.position.set(-100, maxHeight/2, centerZ)  // Position to left side
      trendCamera.up.set(0, 1, 0)  // Keep Y axis up
      trendCamera.lookAt(centerX, maxHeight/2, centerZ)  // Look at center of scene
      trendCamera.zoom = 0.4
      
      // Set controls for trend view
      controls.enableRotate = true  // Allow rotation for better view of trends
      controls.maxPolarAngle = Math.PI / 2  // Limit rotation to horizontal
      controls.minPolarAngle = 0
      controls.target.set(centerX, maxHeight/2, centerZ)
    }
    
    // Common controls for orthographic views
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE  // Allow rotation with right mouse
    }
  } else {
    // 3D perspective view
    currentCamera = perspectiveCamera
    perspectiveCamera.position.set(100, 100, 100)
    perspectiveCamera.up.set(0, 1, 0)
    perspectiveCamera.lookAt(centerX, 0, centerZ)
    
    // Full controls for 3D view
    controls.enableRotate = true
    controls.maxPolarAngle = Math.PI
    controls.minPolarAngle = 0
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    }
    controls.target.set(centerX, 0, centerZ)
  }

  controls.object = currentCamera
  currentCamera.updateProjectionMatrix()
  controls.update()
  
  // Re-render bars when view changes
  createBars()
}

const saveDebugData = () => {
  generateAndSaveDebugData()
}

const clearScenario = () => {
  console.log('Clear scenario clicked')
}

const commitScenario = () => {
  console.log('Commit scenario clicked')
}

// Add the file handler function
const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    console.log('File selected:', file.name)
    // Reset input value to allow uploading the same file again
    (event.target as HTMLInputElement).value = ''
  }
}

onMounted(async () => {
  try {
    initializeData()
    // Then initialize the scene
    initThreeScene()
    
    window.addEventListener('resize', () => {
      if (!container.value) return
      
      const aspect = container.value.clientWidth / container.value.clientHeight
      
      if (currentView !== '3d') {
        const viewSize = 50
        orthographicCamera.left = -viewSize * aspect
        orthographicCamera.right = viewSize * aspect
        orthographicCamera.top = viewSize
        orthographicCamera.bottom = -viewSize
        orthographicCamera.updateProjectionMatrix()
        
        // NEW: Update trendCamera on resize as well
        trendCamera.left = -viewSize * aspect
        trendCamera.right = viewSize * aspect
        trendCamera.top = viewSize
        trendCamera.bottom = -viewSize
        trendCamera.updateProjectionMatrix()
      } else {
        perspectiveCamera.aspect = aspect
        perspectiveCamera.updateProjectionMatrix()
      }
      
      renderer.setSize(container.value.clientWidth, container.value.clientHeight)
      labelRenderer.value?.setSize(container.value.clientWidth, container.value.clientHeight)
    })
  } catch (error) {
    console.error('Error:', error)
  }
})

onUnmounted(() => {
  // Stop animation loop first
  if (typeof window !== 'undefined') {
    window.cancelAnimationFrame(animate)
  }

  // Dispose of controls before scene cleanup
  if (controls) {
    controls.dispose()
    controls = null
  }

  // Remove all objects from scene
  if (scene) {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (object.material instanceof THREE.Material) {
          object.material.dispose()
        } else if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose())
        }
      }
    })
    scene.clear()
    scene = null
  }
  
  // Clean up renderers
  if (renderer) {
    if (container.value) {
      container.value.removeChild(renderer.domElement)
    }
    renderer.dispose()
    renderer = null
  }

  if (labelRenderer.value) {
    if (container.value && labelRenderer.value.domElement) {
      container.value.removeChild(labelRenderer.value.domElement)
    }
    labelRenderer.value = null
  }

  // Clear container
  if (container.value) {
    container.value.innerHTML = ''
  }

  // Clear references
  bars = []
  currentCamera = null
  perspectiveCamera = null
  orthographicCamera = null
  trendCamera = null
})

defineExpose({
  setOrthographicView
})

// Add watch for view options changes
watch(
  () => props.viewOptions,
  () => {
    if (scene) createBars()
  },
  { deep: true }
)

// Add watch for selected job changes
watch(
  () => props.selectedJob,
  () => {
    if (scene) createBars()
  }
)

// Add watch for useScheduled changes
watch(
  () => props.viewOptions.useScheduled,
  () => {
    if (scene) createBars()
  }
)

// Add watch for selected group changes
watch(
  () => props.selectedGroup,
  () => {
    if (scene) createBars()
  }
)

// Add a watch for currentView changes
watch(
  () => currentView,
  () => {
    if (scene) createBars()
  }
)

// Add watch for date changes
watch(
  [() => props.startDate, () => props.endDate],
  () => {
    if (scene) createBars()
  }
)
</script>

<style scoped>
.three-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

.label {
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 2px;
}

.label.plaque {
  background: rgba(220, 220, 220, 0.9);
  border: 1px solid #999;
  padding: 3px 6px;
  white-space: nowrap;
  font-size: 9px;  /* Smaller font to fit longer date strings */
}

.save-debug-data {
  position: absolute;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000;
}

.save-debug-data:hover {
  background: #45a049;
}

.action-buttons {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 1000;
}

.icon-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
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

.icon-button .material-icons {
  font-size: 20px;
}

.color-legend {
  position: absolute;
  right: 60px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 1000;
}

.legend-title {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.legend-gradient {
  width: 20px;
  height: 200px;
  background: linear-gradient(
    to bottom,
    #fde725, /* Flipped Viridis color scale */
    #7ad151,
    #22a884,
    #2a788e,
    #414487,
    #440154
  );
  border-radius: 4px;
}

.legend-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 200px;
  font-size: 12px;
  color: #666;
  padding-left: 8px;
}

.hidden {
  display: none;
}

/* Remove old button styles */
.scenario-buttons, .upload-container {
  display: none;
}
</style>
