import * as THREE from 'three'
import type { DisplayParams } from './plant.js'
import {
  MaterialManager,
  TreeArchetype,
  ArchetypeMaterials,
  BranchConfig,
  ARCHETYPE_CONFIGS,
} from './materials.js'
import type { ParticleSystem3D } from './particles3d.js'
import type { TreeLifecycle } from './lifecycle.js'
import type { Riddles3D } from './riddles3d.js'
import type { RiddleManager } from '../riddles.js'

export class Tree3D {
  readonly group = new THREE.Group()
  private treeContainer = new THREE.Group()
  private leafInstancedMesh: THREE.InstancedMesh
  private branchGroup = new THREE.Group()
  private flowerGroup = new THREE.Group()
  private lightsGroup = new THREE.Group()

  private leafTransforms: THREE.Matrix4[] = []
  private flowerPetalMeshes: THREE.Mesh[] = []
  private pointLights: THREE.PointLight[] = []
  private branchTipPositions: THREE.Vector3[] = []
  private activeArchetype: TreeArchetype = 'oak'

  // Smooth lerp state for continuous zero-pop growth
  private currentScale = 0.65
  private currentGrowth = 0 // 0..1 reveal: how much of the branch skeleton is shown
  private currentVitality = 0.3
  private currentPetalAngle = 0.05
  private currentLightIntensity = 0.4
  private currentDroopAngle = 0

  constructor(private materials: MaterialManager) {
    this.group.add(this.treeContainer)
    this.treeContainer.add(this.branchGroup)
    this.treeContainer.add(this.flowerGroup)
    this.treeContainer.add(this.lightsGroup)

    const leafGeo = new THREE.SphereGeometry(0.2, 8, 8)
    leafGeo.scale(0.35, 0.1, 0.75)
    const oakMats = materials.get('oak')
    this.leafInstancedMesh = new THREE.InstancedMesh(leafGeo, oakMats.leaf, 6000)
    this.treeContainer.add(this.leafInstancedMesh)

    for (let i = 0; i < 16; i++) {
      const light = new THREE.PointLight(0xfef08a, 0, 5)
      this.pointLights.push(light)
      this.lightsGroup.add(light)
    }

    this.buildTreeSkeleton(oakMats)
  }

  setArchetype(archetype: TreeArchetype) {
    if (this.activeArchetype === archetype) return
    this.activeArchetype = archetype
    const mats = this.materials.get(archetype)
    this.leafInstancedMesh.material = mats.leaf
    this.buildTreeSkeleton(mats)
  }

  getActiveArchetype(): TreeArchetype {
    return this.activeArchetype
  }

  getBranchTipPositions(): THREE.Vector3[] {
    return this.branchTipPositions
  }

  private buildTreeSkeleton(mats: ArchetypeMaterials) {
    while (this.branchGroup.children.length > 0) {
      const c = this.branchGroup.children[0] as THREE.Mesh
      if (c.geometry) c.geometry.dispose()
      this.branchGroup.remove(c)
    }
    while (this.flowerGroup.children.length > 0) {
      const c = this.flowerGroup.children[0] as THREE.Mesh
      if (c.geometry) c.geometry.dispose()
      this.flowerGroup.remove(c)
    }

    this.leafTransforms = []
    this.flowerPetalMeshes = []
    this.branchTipPositions = []

    const cfg = ARCHETYPE_CONFIGS[this.activeArchetype]

    if (this.activeArchetype === 'willow') {
      this.growWillowTree(mats, cfg)
    } else if (this.activeArchetype === 'sakura') {
      this.growSakuraTree(mats, cfg)
    } else if (this.activeArchetype === 'redwood') {
      this.growRedwoodTree(mats, cfg)
    } else {
      this.growOakTree(mats, cfg)
    }

    this.leafInstancedMesh.count = Math.min(this.leafTransforms.length, 6000)
    for (let i = 0; i < this.leafInstancedMesh.count; i++) {
      this.leafInstancedMesh.setMatrixAt(i, this.leafTransforms[i])
    }
    this.leafInstancedMesh.instanceMatrix.needsUpdate = true
  }

  // --- 1. Ancient Oak ---
  private growOakTree(mats: ArchetypeMaterials, cfg: BranchConfig) {
    const rootPos = new THREE.Vector3(0, 0, 0)
    const rootDir = new THREE.Vector3(0, 1, 0)
    this.growOakBranch(rootPos, rootDir, cfg.trunkHeight, cfg.trunkRadius, 0, mats, cfg)
  }

  private growOakBranch(
    start: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    mats: ArchetypeMaterials,
    cfg: BranchConfig
  ) {
    if (depth > cfg.maxDepth || length < 0.15) return

    const gnarledX = depth === 0 ? 0 : (Math.sin(depth * 2.5) + (Math.random() - 0.5)) * length * cfg.gnarliness
    const gnarledZ = depth === 0 ? 0 : (Math.sin(depth * 3.7 + 1.2) + (Math.random() - 0.5)) * length * cfg.gnarliness
    const sag = (1 - dir.y) * cfg.gravitySag * length
    const midBend = new THREE.Vector3(gnarledX, length * 0.5 * (1 - depth * 0.15) - sag, gnarledZ)
    const end = start.clone().add(dir.clone().multiplyScalar(length))
    const midPoint = start.clone().add(end).multiplyScalar(0.5).add(midBend)

    this.addBranchSegment(start, midPoint, end, radius, mats, depth / cfg.maxDepth)

    if (depth >= cfg.maxDepth - 1) {
      this.branchTipPositions.push(end.clone())
      this.addLeafCluster(end, cfg.leafClusterDensity)
      this.addFlowerMesh(end, mats)
      return
    }

    for (let i = 0; i < cfg.numChildren; i++) {
      const phi = (i / cfg.numChildren) * Math.PI * 2 + depth * 2.4
      const childDir = dir.clone()
      const perp = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)).normalize()
      childDir.addScaledVector(perp, cfg.spreadAngle).normalize()
      this.growOakBranch(end, childDir, length * cfg.lengthRatio, radius * cfg.radiusRatio, depth + 1, mats, cfg)
    }
  }

  // --- 2. Weeping Willow ---
  private growWillowTree(mats: ArchetypeMaterials, cfg: BranchConfig) {
    const rootPos = new THREE.Vector3(0, 0, 0)
    const trunkEnd = new THREE.Vector3(0, cfg.trunkHeight, 0)
    this.addBranchSegment(rootPos, new THREE.Vector3(0, 1.2, 0), trunkEnd, cfg.trunkRadius, mats, 0)

    const numLimbs = 6
    for (let i = 0; i < numLimbs; i++) {
      const phi = (i / numLimbs) * Math.PI * 2
      const limbDir = new THREE.Vector3(Math.cos(phi) * 1.1, 0.45, Math.sin(phi) * 1.1).normalize()
      const limbEnd = trunkEnd.clone().add(limbDir.clone().multiplyScalar(2.6))
      this.addBranchSegment(trunkEnd, trunkEnd.clone().add(limbEnd).multiplyScalar(0.5), limbEnd, cfg.trunkRadius * 0.75, mats, 0.3)
      this.branchTipPositions.push(limbEnd.clone())

      for (let v = 0; v < 8; v++) {
        const vPhi = (v / 8) * Math.PI * 2
        const vineStart = limbEnd.clone().add(new THREE.Vector3(Math.cos(vPhi) * 0.7, 0, Math.sin(vPhi) * 0.7))
        this.growWillowVine(vineStart, mats, cfg)
      }
    }
  }

  private growWillowVine(start: THREE.Vector3, mats: ArchetypeMaterials, cfg: BranchConfig) {
    let curr = start.clone()
    const segLen = 0.24
    let radius = 0.09

    for (let s = 0; s < cfg.maxDepth; s++) {
      const next = curr.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        -segLen,
        (Math.random() - 0.5) * 0.08
      ))
      this.addBranchSegment(curr, curr.clone().add(next).multiplyScalar(0.5), next, radius, mats, 0.4 + 0.6 * (s / Math.max(1, cfg.maxDepth - 1)))
      this.addLeafCluster(next, cfg.leafClusterDensity)
      if (s === cfg.maxDepth - 1) {
        this.addFlowerMesh(next, mats)
        this.branchTipPositions.push(next.clone())
      }
      curr = next
      radius = Math.max(radius * cfg.radiusRatio, 0.025)
    }
  }

  // --- 3. Sakura ---
  private growSakuraTree(mats: ArchetypeMaterials, cfg: BranchConfig) {
    const rootPos = new THREE.Vector3(0, 0, 0)
    const rootDir = new THREE.Vector3(0, 1, 0)
    this.growSakuraBranch(rootPos, rootDir, cfg.trunkHeight, cfg.trunkRadius, 0, mats, cfg)
  }

  private growSakuraBranch(
    start: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    mats: ArchetypeMaterials,
    cfg: BranchConfig
  ) {
    if (depth > cfg.maxDepth || length < 0.15) return

    const end = start.clone().add(dir.clone().multiplyScalar(length))
    const midPoint = start.clone().add(end).multiplyScalar(0.5)
    this.addBranchSegment(start, midPoint, end, radius, mats, depth / cfg.maxDepth)

    if (depth >= cfg.maxDepth - 1) {
      this.branchTipPositions.push(end.clone())
      this.addLeafCluster(end, cfg.leafClusterDensity)
      this.addFlowerMesh(end, mats)
      return
    }

    for (let i = 0; i < cfg.numChildren; i++) {
      const phi = (i / cfg.numChildren) * Math.PI * 2 + depth * 1.6
      const childDir = dir.clone().add(new THREE.Vector3(Math.cos(phi) * cfg.spreadAngle, 0.15, Math.sin(phi) * cfg.spreadAngle)).normalize()
      this.growSakuraBranch(end, childDir, length * cfg.lengthRatio, radius * cfg.radiusRatio, depth + 1, mats, cfg)
    }
  }

  // --- 4. Solar Redwood ---
  private growRedwoodTree(mats: ArchetypeMaterials, cfg: BranchConfig) {
    const segments = cfg.maxDepth
    let curr = new THREE.Vector3(0, 0, 0)
    let radius = cfg.trunkRadius
    const stepHeight = cfg.trunkHeight / segments

    for (let s = 0; s < segments; s++) {
      const next = curr.clone().add(new THREE.Vector3(0, stepHeight, 0))
      this.addBranchSegment(curr, curr.clone().add(next).multiplyScalar(0.5), next, radius, mats, 0.5 * (s / segments))

      if (s >= 2) {
        const branchLen = (1 - s / segments) * 3.8 + 0.8
        for (let b = 0; b < cfg.numChildren; b++) {
          const phi = (b / cfg.numChildren) * Math.PI * 2 + s * 0.8
          const bDir = new THREE.Vector3(Math.cos(phi), cfg.gravitySag, Math.sin(phi)).normalize()
          const bEnd = next.clone().add(bDir.multiplyScalar(branchLen))
          this.addBranchSegment(next, next.clone().add(bEnd).multiplyScalar(0.5), bEnd, radius * 0.38, mats, 0.5 + 0.5 * (s / segments))
          this.addLeafCluster(bEnd, cfg.leafClusterDensity)
          this.addFlowerMesh(bEnd, mats)
          this.branchTipPositions.push(bEnd.clone())
        }
      }

      curr = next
      radius *= cfg.radiusRatio
    }
  }

  private addBranchSegment(
    start: THREE.Vector3,
    mid: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    mats: ArchetypeMaterials,
    order = 0 // 0 = trunk (appears first), 1 = outermost twig (appears last)
  ) {
    const curve = new THREE.CatmullRomCurve3([start, mid, end])
    const tubeGeo = new THREE.TubeGeometry(curve, 7, radius, 8, false)
    const branchMesh = new THREE.Mesh(tubeGeo, mats.bark)
    branchMesh.userData.order = order
    this.branchGroup.add(branchMesh)

    const jointGeo = new THREE.SphereGeometry(radius * 1.05, 8, 8)
    const jointMesh = new THREE.Mesh(jointGeo, mats.joint)
    jointMesh.position.copy(start)
    jointMesh.userData.order = order
    this.branchGroup.add(jointMesh)
  }

  private addLeafCluster(pos: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      if (this.leafTransforms.length >= 6000) break
      const mat = new THREE.Matrix4()
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      )
      const leafPos = pos.clone().add(offset)
      const leafRot = new THREE.Euler(
        (Math.random() - 0.5) * 1.6,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 1.6
      )
      mat.makeRotationFromEuler(leafRot)
      mat.setPosition(leafPos)
      this.leafTransforms.push(mat)
    }
  }

  private addFlowerMesh(pos: THREE.Vector3, mats: ArchetypeMaterials) {
    const flowerGroup = new THREE.Group()
    flowerGroup.position.copy(pos)

    const petalCount = 6
    const petalGeo = new THREE.SphereGeometry(0.12, 8, 8)
    petalGeo.scale(0.55, 0.14, 0.95)

    for (let p = 0; p < petalCount; p++) {
      const petalMesh = new THREE.Mesh(petalGeo, mats.blossom)
      const angle = (p / petalCount) * Math.PI * 2
      petalMesh.position.set(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12)
      petalMesh.rotation.y = angle
      petalMesh.rotation.x = 0.4
      flowerGroup.add(petalMesh)
      this.flowerPetalMeshes.push(petalMesh)
    }

    const stamenGeo = new THREE.SphereGeometry(0.06, 8, 8)
    const stamenMesh = new THREE.Mesh(stamenGeo, mats.stamen)
    stamenMesh.position.set(0, 0.05, 0)
    flowerGroup.add(stamenMesh)

    this.flowerGroup.add(flowerGroup)
  }

  update(
    P: DisplayParams,
    lifecycle: TreeLifecycle,
    particles: ParticleSystem3D,
    riddles3d: Riddles3D,
    riddleManager: RiddleManager,
    t: number
  ) {
    const stage = lifecycle.getStage()

    // Growth reveal & bloom targets. The tree does NOT change size — instead
    // more of the branch skeleton is revealed as the user speaks: trunk first,
    // then limbs, twigs, leaves and finally blossoms.
    const targetGrowth = stage === 'happy_ending' ? 1 : lifecycle.getVoiceGrowth()
    const targetBloomProgress = lifecycle.getBloomProgress()
    const targetLightIntensity = stage === 'happy_ending' ? 1.2 : stage === 'consoling' ? 0.8 : 0.4

    // Droop state from voice sentiment / pitch
    const rawTargetDroop = lifecycle.getDroopIntensity()
    // Fade out droop tilt as growth matures towards 100% so fully built tree stands perfectly straight!
    const growthMaturity = Math.min(1, Math.max(0, (this.currentGrowth - 0.4) / 0.6))
    const targetDroop = stage === 'happy_ending' ? 0 : rawTargetDroop * (1 - growthMaturity)

    const isSadPitch = P.bias < -0.25 || P.vitality < 0.35 || targetDroop > 0.4

    // Smooth lerps. currentGrowth eases in gently so branches sprout gradually
    // rather than popping in all at once.
    this.currentGrowth += (targetGrowth - this.currentGrowth) * 0.03
    this.currentVitality += (targetBloomProgress - this.currentVitality) * 0.02
    this.currentPetalAngle += (targetBloomProgress * 1.1 - this.currentPetalAngle) * 0.03
    this.currentLightIntensity += (targetLightIntensity - this.currentLightIntensity) * 0.05
    this.currentDroopAngle += (targetDroop * 0.35 - this.currentDroopAngle) * 0.06

    // Hierarchical Wind Sway + Sad Droop tilt (centered at 0 for straight upright posture)
    const swayX = Math.sin(t * 1.3) * P.sway * 0.25 + this.currentDroopAngle
    const swayZ = Math.cos(t * 1.0) * P.sway * 0.25
    this.treeContainer.rotation.x = swayX
    this.treeContainer.rotation.z = swayZ

    // Fixed size — never scales. A hair of overshoot lets outermost twigs show.
    this.treeContainer.scale.setScalar(1.0)
    const reveal = this.currentGrowth

    // Reveal branch segments whose growth-order has been reached.
    for (const child of this.branchGroup.children) {
      const order = (child.userData.order as number) ?? 0
      child.visible = order <= reveal + 0.02
    }

    // Leaves fill in over the second half of growth; blossoms only near the end.
    const totalLeaves = Math.min(this.leafTransforms.length, 6000)
    const leafFrac = Math.max(0, Math.min(1, (reveal - 0.5) / 0.5))
    this.leafInstancedMesh.count = Math.floor(totalLeaves * leafFrac)
    this.flowerGroup.visible = reveal > 0.75

    // Unfold multi-petaled flowers
    for (const petal of this.flowerPetalMeshes) {
      petal.rotation.x = 0.1 + this.currentPetalAngle
    }

    // Dynamic blossom light emission & color response (subtle non-neon emissive glow!)
    const mats = this.materials.get(this.activeArchetype)
    mats.blossom.emissiveIntensity = 0.4 + this.currentVitality * 0.4 + P.glow * 0.3
    mats.leaf.emissiveIntensity = isSadPitch ? 0.05 : 0.15 + this.currentVitality * 0.2

    for (let i = 0; i < this.pointLights.length; i++) {
      const light = this.pointLights[i]
      light.color.copy(mats.moteColor)
      light.intensity = this.currentLightIntensity
      const angle = (i / this.pointLights.length) * Math.PI * 2 + t * 0.4
      light.position.set(Math.cos(angle) * 3.5, 3.5 + Math.sin(t + i) * 0.8, Math.sin(angle) * 3.5)
    }

    // Petal Shedding on Sad/Low Pitch or Venting Droop
    if (isSadPitch && Math.random() < 0.45 && this.branchTipPositions.length > 0) {
      const randomTip = this.branchTipPositions[Math.floor(Math.random() * this.branchTipPositions.length)]
      particles.spawnFallingPetalRain(randomTip, this.activeArchetype, 2)
    }

    // Happy / Consoling upward energy motes
    if ((stage === 'consoling' || stage === 'happy_ending') && Math.random() < 0.4) {
      const spawnPos = new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        2.0 + Math.random() * 4.5,
        (Math.random() - 0.5) * 4.5
      )
      particles.spawnMote(spawnPos, this.activeArchetype)
    }

    // Check riddle unlocks as plant grows
    const normalizedGrowth = this.currentGrowth
    riddleManager.checkGrowth(normalizedGrowth)

    // Place 3D riddle blossoms on branch tips for unlocked riddles
    const unlocked = riddleManager.getUnlockedRiddles()
    unlocked.forEach((r, idx) => {
      if (this.branchTipPositions.length > idx) {
        const tip = this.branchTipPositions[idx * 3 % this.branchTipPositions.length]
        riddles3d.addRiddleNode(r, tip)
      }
    })
    riddles3d.update(t)
  }
}
