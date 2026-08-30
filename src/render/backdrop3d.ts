import * as THREE from 'three'
import type { TreeArchetype, MaterialManager } from './materials.js'

export class Backdrop3D {
  readonly group = new THREE.Group()
  private starPoints: THREE.Points
  private groundMesh: THREE.Mesh
  private groundMaterial: THREE.MeshStandardMaterial

  constructor(_materials: MaterialManager) {
    const starCount = 1200
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 25 + Math.random() * 25
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPos[i * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 1
      starPos[i * 3 + 2] = r * Math.cos(phi)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })
    this.starPoints = new THREE.Points(starGeo, starMat)
    this.group.add(this.starPoints)

    const groundGeo = new THREE.CircleGeometry(12, 48)
    groundGeo.rotateX(-Math.PI / 2)
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x09131d,
      roughness: 0.9,
      emissive: 0x022c22,
      emissiveIntensity: 0.35,
    })
    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial)
    this.groundMesh.position.y = 0
    this.group.add(this.groundMesh)
  }

  update(archetype: TreeArchetype, dt: number) {
    this.starPoints.rotation.y += dt * 0.015

    if (archetype === 'oak') {
      this.groundMaterial.emissive.setHex(0x022c22)
    } else if (archetype === 'willow') {
      this.groundMaterial.emissive.setHex(0x3f2e18)
    } else if (archetype === 'sakura') {
      this.groundMaterial.emissive.setHex(0x500724)
    } else if (archetype === 'redwood') {
      this.groundMaterial.emissive.setHex(0x0c4a6e)
    }
  }
}
