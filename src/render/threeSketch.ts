import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { Plant, DEFAULT_CONTROLS, type PlantControls } from './plant.js'
import { MaterialManager, type TreeArchetype } from './materials.js'
import { ParticleSystem3D } from './particles3d.js'
import { Tree3D } from './tree3d.js'
import { Backdrop3D } from './backdrop3d.js'
import { Grass3D } from './grass3d.js'
import { TreeLifecycle } from './lifecycle.js'
import { Riddles3D } from './riddles3d.js'
import { RiddleManager } from '../riddles.js'

let plant: Plant
let materials: MaterialManager
let particles: ParticleSystem3D
let tree: Tree3D
let backdrop: Backdrop3D
let grass: Grass3D
let riddles3d: Riddles3D
let riddleManager = new RiddleManager()
let lifecycleInstance = new TreeLifecycle()
let controls: PlantControls = { ...DEFAULT_CONTROLS }

let activeCamera: THREE.PerspectiveCamera
let orbitControls: OrbitControls
let autoRotateEnabled = true

export function setTreeArchetype(archetype: TreeArchetype) {
  if (tree) {
    tree.setArchetype(archetype)
  }
  if (grass) {
    grass.setEnvironment(archetype)
  }
}

export function setLifecycleInstance(instance: TreeLifecycle) {
  lifecycleInstance = instance
}

export function getRiddleManager(): RiddleManager {
  return riddleManager
}

export function resetCamera() {
  if (orbitControls && activeCamera) {
    // Zoomed-out framing: pull back and up so the entire tree (tallest species
    // ~9 units) is visible, centred on its mid-height. Stays within maxDistance.
    activeCamera.position.set(0, 6.5, 20)
    orbitControls.target.set(0, 4.2, 0)
    orbitControls.update()
  }
}

export function toggleAutoRotate(): boolean {
  autoRotateEnabled = !autoRotateEnabled
  if (orbitControls) {
    orbitControls.autoRotate = autoRotateEnabled
  }
  return autoRotateEnabled
}

export function startThreeSketch(container: HTMLElement) {
  container.innerHTML = ''

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x060a12)

  const aspect = window.innerWidth / window.innerHeight
  activeCamera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100)
  activeCamera.position.set(0, 4.2, 11)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ReinhardToneMapping
  renderer.toneMappingExposure = 1.3
  container.appendChild(renderer.domElement)

  // 3D Spatial Navigation Controls
  orbitControls = new OrbitControls(activeCamera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.04
  orbitControls.target.set(0, 3.8, 0)
  orbitControls.minDistance = 3.5
  orbitControls.maxDistance = 25
  // Full 360° orbit: unlimited horizontal, and near-complete vertical freedom
  // (kept a hair off the exact poles to avoid gimbal flip).
  orbitControls.minPolarAngle = 0.05
  orbitControls.maxPolarAngle = Math.PI - 0.05
  orbitControls.autoRotate = autoRotateEnabled
  orbitControls.autoRotateSpeed = 0.75
  orbitControls.update()

  const ambientLight = new THREE.AmbientLight(0x1e2e42, 1.3)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2)
  dirLight.position.set(12, 40, 15)
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.55)
  fillLight.position.set(-15, 20, -15)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xfef08a, 0.45)
  rimLight.position.set(0, 15, -25)
  scene.add(rimLight)

  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, activeCamera)
  composer.addPass(renderPass)

  // Subtler, serene bloom pass (reduced glow as requested!)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // subtle bloom strength
    0.45, // radius
    0.22  // threshold
  )
  composer.addPass(bloomPass)

  plant = new Plant()
  materials = new MaterialManager()
  backdrop = new Backdrop3D(materials)
  scene.add(backdrop.group)

  grass = new Grass3D()
  scene.add(grass.group)

  particles = new ParticleSystem3D(scene, materials)
  riddles3d = new Riddles3D()
  scene.add(riddles3d.group)

  tree = new Tree3D(materials)
  scene.add(tree.group)

  let lastT = performance.now()
  // Camera auto-framing state (eased toward targets each frame).
  let camDist = 12
  let camTargetY = 3.2

  function animate() {
    requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min((now - lastT) / 1000, 0.1)
    lastT = now

    plant.tick(controls, dt)
    lifecycleInstance.tick(dt)
    // Grow the tree gradually from the user's live voice.
    lifecycleInstance.feedVoice(controls.energy, controls.pitch, dt)
    const P = plant.params()

    // Auto-frame: as the tree reveals more of itself, ease the camera back and
    // up so the WHOLE tree stays in view for the entire session. Only zoom
    // distance + look-height are managed — the user's orbit angle (and the
    // auto-rotate spin) are preserved.
    const growth = lifecycleInstance.getStage() === 'happy_ending'
      ? 1
      : lifecycleInstance.getVoiceGrowth()
    const desiredDist = 12 + growth * 11      // 12 (sprout) -> 23 (full tree)
    const desiredTargetY = 3.0 + growth * 1.3 // rise as the canopy climbs
    camDist += (desiredDist - camDist) * 0.02
    camTargetY += (desiredTargetY - camTargetY) * 0.02

    const gentleBob = autoRotateEnabled ? Math.sin(now * 0.0006) * 0.12 : 0
    orbitControls.target.set(0, camTargetY + gentleBob, 0)
    // Re-seat the camera at camDist along its current viewing angle.
    const camOffset = activeCamera.position.clone().sub(orbitControls.target)
    camOffset.setLength(camDist)
    activeCamera.position.copy(orbitControls.target).add(camOffset)
    orbitControls.update()

    backdrop.update(tree.getActiveArchetype(), dt)
    grass.setEnvironment(tree.getActiveArchetype())
    grass.update(now * 0.001)

    tree.update(P, lifecycleInstance, particles, riddles3d, riddleManager, now * 0.001)
    particles.tick(dt)

    const stage = lifecycleInstance.getStage()
    bloomPass.strength = stage === 'happy_ending' ? 1.25 : 0.55 + P.glow * 0.4

    composer.render()
  }

  animate()

  window.addEventListener('resize', () => {
    activeCamera.aspect = window.innerWidth / window.innerHeight
    activeCamera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
  })
}

export function updateControls(next: PlantControls) {
  controls = next
}
