<template>
  <div ref="container" class="three-container">
    <!-- Three.js will render here -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import type { CapacityData } from '@/types/chart.types'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import { withDefaults } from 'vue'

const props = withDefaults(defineProps<{
  data: CapacityData[]
  selectedGroup: string | null
}>(), {
  data: () => [],
  selectedGroup: null
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

const generateDates = () => {
  const startDate = new Date('2025-02-24')
  const dates: Date[] = []
  for (let i = 0; i < 21; i++) {  // 3 weeks = 21 days
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    dates.push(date)
  }
  console.log('Generated dates:', dates.length);
  return dates
}

const initThreeScene = () => {
  if (!container.value) return

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
  
  createAxesLabels()
  
  createBars()
  animate()
}

const createBars = () => {
  if (!props.data) return;
  
  bars.forEach(bar => scene.remove(bar))
  bars = []
  
  props.data.forEach((item, groupIndex) => {
    const groupLabel = createLabel(item.resourceGroupId)
    // Move group labels one unit away from Z axis
    groupLabel.position.set((groupIndex + 1) * SPACING, 0, -SPACING)
    scene.add(groupLabel)

    item.dailyCapacities.forEach((capacity, dayIndex) => {
      const bar = createBar(capacity, groupIndex + 1, dayIndex + 1)  // Add 1 to both indices
      scene.add(bar)
      bars.push(bar)
    })
  })

  generateDates().forEach((date, dayIndex) => {
    const dateLabel = createLabel(date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }))
    // Move date labels one unit away from X axis
    dateLabel.position.set(-SPACING, 0, (dayIndex + 1) * SPACING)
    scene.add(dateLabel)
  })
}

const createBar = (height: number, x: number, z: number) => {
  // Change scaling factor from /10 to /2 to make bars 5x taller
  const scaledHeight = height / 2
  
  // Increase box width and depth
  const geometry = new THREE.BoxGeometry(BOX_SIZE, 0.1, BOX_SIZE)
  const material = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide
  })
  
  const mesh = new THREE.Mesh(geometry, material)
  
  // Use new spacing constant
  mesh.position.set(x * SPACING, scaledHeight, z * SPACING)
  
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
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, currentCamera)
  labelRenderer.value?.render(scene, currentCamera)
}

const setOrthographicView = (viewType: ViewType) => {
  if (!orthographicCamera || !perspectiveCamera || !trendCamera) return
  
  currentView = viewType
  // Adjust centers to account for the offset
  const centerX = ((props.data.length + 1) * SPACING) / 2
  const centerZ = ((21 + 1) * SPACING) / 2
  const maxHeight = 50  // Increased from 10 to 50 to match new scale
  
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
}

onMounted(() => {
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
})

onUnmounted(() => {
  renderer?.dispose()
  labelRenderer.value?.dispose()
})

defineExpose({
  setOrthographicView
})
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
</style>
