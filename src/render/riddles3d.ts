import * as THREE from 'three'
import type { Riddle } from '../riddles.js'

export class Riddles3D {
  readonly group = new THREE.Group()
  private riddleNodes: Map<string, THREE.Group> = new Map()

  constructor() {}

  addRiddleNode(riddle: Riddle, position: THREE.Vector3) {
    if (this.riddleNodes.has(riddle.id)) return

    const nodeGroup = new THREE.Group()
    nodeGroup.position.copy(position)

    // Ethereal glowing orb core
    const orbGeo = new THREE.SphereGeometry(0.22, 16, 16)
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 2.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95,
    })
    const orbMesh = new THREE.Mesh(orbGeo, orbMat)
    nodeGroup.add(orbMesh)

    // Outer spinning flower ring / halo
    const ringGeo = new THREE.TorusGeometry(0.35, 0.03, 8, 24)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfacc15,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.name = 'ring'
    nodeGroup.add(ringMesh)

    // Soft point light
    const pLight = new THREE.PointLight(0xfef08a, 2.5, 4)
    nodeGroup.add(pLight)

    nodeGroup.userData = { riddle }

    this.group.add(nodeGroup)
    this.riddleNodes.set(riddle.id, nodeGroup)
  }

  update(timeSec: number) {
    this.riddleNodes.forEach((nodeGroup) => {
      const floatOffsetY = Math.sin(timeSec * 2.2 + nodeGroup.position.x) * 0.08
      nodeGroup.position.y += floatOffsetY * 0.02

      const ring = nodeGroup.getObjectByName('ring')
      if (ring) {
        ring.rotation.x = timeSec * 1.5
        ring.rotation.y = timeSec * 1.2
      }
    })
  }

  clear() {
    while (this.group.children.length > 0) {
      const c = this.group.children[0]
      this.group.remove(c)
    }
    this.riddleNodes.clear()
  }
}
