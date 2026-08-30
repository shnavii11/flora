import * as THREE from 'three'
import type { TreeArchetype } from './materials.js'

export interface EnvironmentStyle {
  groundColor: number
  grassColor1: number
  grassColor2: number
  bladeHeight: number
  bladeDensity: number
}

export const ENVIRONMENT_STYLES: Record<TreeArchetype, EnvironmentStyle> = {
  oak: {
    groundColor: 0x142b17,
    grassColor1: 0x22c55e,
    grassColor2: 0x15803d,
    bladeHeight: 0.42,
    bladeDensity: 35000,
  },
  willow: {
    groundColor: 0x0f221a,
    grassColor1: 0x10b981,
    grassColor2: 0x047857,
    bladeHeight: 0.52,
    bladeDensity: 35000,
  },
  sakura: {
    groundColor: 0x2a1424,
    grassColor1: 0xdb2777,
    grassColor2: 0x831843,
    bladeHeight: 0.36,
    bladeDensity: 35000,
  },
  redwood: {
    groundColor: 0x121b28,
    grassColor1: 0x0ea5e9,
    grassColor2: 0x0369a1,
    bladeHeight: 0.58,
    bladeDensity: 35000,
  },
}

export class Grass3D {
  readonly group = new THREE.Group()
  private groundMesh: THREE.Mesh
  private grassMesh: THREE.InstancedMesh
  private currentArchetype: TreeArchetype = 'oak'
  private dummy = new THREE.Object3D()
  private bladeTransforms: {
    pos: THREE.Vector3
    rotY: number
    tiltX: number
    tiltZ: number
    scaleY: number
    scaleXZ: number
  }[] = []

  constructor() {
    // Ground plane matching grass root color
    const groundGeo = new THREE.PlaneGeometry(80, 80, 16, 16)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new THREE.MeshStandardMaterial({
      color: ENVIRONMENT_STYLES.oak.groundColor,
      roughness: 0.95,
      metalness: 0.02,
    })
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat)
    this.groundMesh.position.y = -0.05
    this.group.add(this.groundMesh)

    // Create realistic 3D curved grass blade geometry with vertex parabolic arc
    const bladeGeo = new THREE.PlaneGeometry(0.12, 0.48, 1, 6)
    bladeGeo.translate(0, 0.24, 0)
    const posAttr = bladeGeo.attributes.position

    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i)
      const normY = y / 0.48 // 0 at base, 1 at tip
      // Parabolic arc curvature bending backward
      const curveZ = Math.pow(normY, 1.8) * 0.16
      // Natural blade width tapering toward the tip
      const origX = posAttr.getX(i)
      const taperWidth = 1.0 - Math.pow(normY, 1.4) * 0.8
      posAttr.setX(i, origX * taperWidth)
      posAttr.setZ(i, curveZ)
    }
    bladeGeo.computeVertexNormals()

    const grassMat = new THREE.MeshStandardMaterial({
      color: ENVIRONMENT_STYLES.oak.grassColor1,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })

    this.grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, 38000)
    this.group.add(this.grassMesh)

    this.generateGrassPositions()
  }

  private generateGrassPositions() {
    this.bladeTransforms = []
    const count = 35000
    const radius = 35.0

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius
      const theta = Math.random() * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      const rotY = Math.random() * Math.PI * 2

      // Organic natural tilt inclination so grass blades lean & overlap naturally
      const tiltX = (Math.random() - 0.5) * 0.45
      const tiltZ = (Math.random() - 0.5) * 0.45
      const scaleY = 0.75 + Math.random() * 0.6
      const scaleXZ = 0.85 + Math.random() * 0.5

      this.bladeTransforms.push({
        pos: new THREE.Vector3(x, 0, z),
        rotY,
        tiltX,
        tiltZ,
        scaleY,
        scaleXZ,
      })
    }

    this.updateGrassInstances(0)
  }

  setEnvironment(archetype: TreeArchetype) {
    if (this.currentArchetype === archetype) return
    this.currentArchetype = archetype
    const cfg = ENVIRONMENT_STYLES[archetype]

    const groundMat = this.groundMesh.material as THREE.MeshStandardMaterial
    groundMat.color.setHex(cfg.groundColor)

    const grassMat = this.grassMesh.material as THREE.MeshStandardMaterial
    grassMat.color.setHex(cfg.grassColor1)
  }

  update(timeSec: number) {
    this.updateGrassInstances(timeSec)
  }

  private updateGrassInstances(timeSec: number) {
    const cfg = ENVIRONMENT_STYLES[this.currentArchetype]
    const count = Math.min(this.bladeTransforms.length, cfg.bladeDensity)

    for (let i = 0; i < count; i++) {
      const b = this.bladeTransforms[i]
      const windSwayX = b.tiltX + Math.sin(timeSec * 1.5 + b.pos.x * 0.5) * 0.12
      const windSwayZ = b.tiltZ + Math.cos(timeSec * 1.2 + b.pos.z * 0.5) * 0.1

      this.dummy.position.copy(b.pos)
      this.dummy.rotation.set(windSwayX, b.rotY, windSwayZ)
      this.dummy.scale.set(b.scaleXZ, b.scaleY * (cfg.bladeHeight / 0.42), b.scaleXZ)
      this.dummy.updateMatrix()

      this.grassMesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.grassMesh.count = count
    this.grassMesh.instanceMatrix.needsUpdate = true
  }
}
