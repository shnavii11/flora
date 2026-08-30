import * as THREE from 'three'
import { MAX_PARTICLES } from '../config.js'
import type { TreeArchetype, MaterialManager } from './materials.js'

interface Particle3D {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  rotVelocity: THREE.Vector3
  scale: number
  life: number
  maxLife: number
  kind: 'petal' | 'mote'
  archetype: TreeArchetype
}

export class ParticleSystem3D {
  private particles: Particle3D[] = []
  private petalInstancedMesh: THREE.InstancedMesh
  private motePoints: THREE.Points
  private motePositions: Float32Array
  private dummy = new THREE.Object3D()

  constructor(scene: THREE.Scene, materials: MaterialManager) {
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.18)
    const petalMat = new THREE.MeshStandardMaterial({
      map: materials.glowTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.petalInstancedMesh = new THREE.InstancedMesh(petalGeo, petalMat, MAX_PARTICLES)
    this.petalInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(this.petalInstancedMesh)

    const moteGeo = new THREE.BufferGeometry()
    this.motePositions = new Float32Array(MAX_PARTICLES * 3)
    moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3))
    const moteMat = new THREE.PointsMaterial({
      map: materials.glowTexture,
      size: 0.28,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.motePoints = new THREE.Points(moteGeo, moteMat)
    scene.add(this.motePoints)
  }

  spawnPetal(pos: THREE.Vector3, archetype: TreeArchetype, isShedding: boolean = false) {
    if (this.particles.length >= MAX_PARTICLES) return
    const vy = isShedding ? -0.45 - Math.random() * 0.4 : -0.2 - Math.random() * 0.2
    this.particles.push({
      position: pos.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * (isShedding ? 0.6 : 0.3),
        vy,
        (Math.random() - 0.5) * (isShedding ? 0.6 : 0.3)
      ),
      rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
      rotVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      ),
      scale: 1.0 + Math.random() * 0.6,
      life: 1.0,
      maxLife: 4.5 + Math.random() * 2.5,
      kind: 'petal',
      archetype,
    })
  }

  spawnFallingPetalRain(pos: THREE.Vector3, archetype: TreeArchetype, count: number = 5) {
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 2.5
      )
      this.spawnPetal(pos.clone().add(offset), archetype, true)
    }
  }

  spawnMote(pos: THREE.Vector3, archetype: TreeArchetype) {
    if (this.particles.length >= MAX_PARTICLES) return
    this.particles.push({
      position: pos.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.25,
        0.3 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.25
      ),
      rotation: new THREE.Euler(),
      rotVelocity: new THREE.Vector3(),
      scale: 1.0,
      life: 1.0,
      maxLife: 3.5 + Math.random() * 2.0,
      kind: 'mote',
      archetype,
    })
  }

  tick(dt: number) {
    let petalCount = 0
    let moteIdx = 0

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt / p.maxLife
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      // Wind turbulence & gravity acceleration
      if (p.kind === 'petal') {
        p.velocity.x += Math.sin(p.life * 10) * 0.05 * dt
        p.velocity.z += Math.cos(p.life * 8) * 0.05 * dt
        if (p.position.y <= 0.05) {
          p.velocity.set(0, 0, 0)
        }
      }

      p.position.addScaledVector(p.velocity, dt)

      if (p.kind === 'petal') {
        p.rotation.x += p.rotVelocity.x * dt
        p.rotation.y += p.rotVelocity.y * dt
        this.dummy.position.copy(p.position)
        this.dummy.rotation.copy(p.rotation)
        this.dummy.scale.setScalar(p.scale * Math.sin(p.life * Math.PI))
        this.dummy.updateMatrix()
        this.petalInstancedMesh.setMatrixAt(petalCount++, this.dummy.matrix)
      } else {
        this.motePositions[moteIdx * 3] = p.position.x
        this.motePositions[moteIdx * 3 + 1] = p.position.y
        this.motePositions[moteIdx * 3 + 2] = p.position.z
        moteIdx++
      }
    }

    this.petalInstancedMesh.count = petalCount
    this.petalInstancedMesh.instanceMatrix.needsUpdate = true
    const posAttr = this.motePoints.geometry.attributes.position as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }

  count() {
    return this.particles.length
  }
}
