import * as THREE from 'three'

export type TreeArchetype = 'oak' | 'willow' | 'sakura' | 'redwood'

export interface BranchConfig {
  maxDepth: number
  lengthRatio: number
  radiusRatio: number
  spreadAngle: number
  gravitySag: number
  trunkHeight: number
  trunkRadius: number
  numChildren: number
  gnarliness: number
  leafClusterDensity: number
}

export const ARCHETYPE_CONFIGS: Record<TreeArchetype, BranchConfig> = {
  oak: {
    maxDepth: 5,
    lengthRatio: 0.82,
    radiusRatio: 0.72,
    spreadAngle: 0.82,
    gravitySag: 0.2,
    trunkHeight: 3.5,
    trunkRadius: 0.55,
    numChildren: 4,
    gnarliness: 0.35,
    leafClusterDensity: 12,
  },
  willow: {
    maxDepth: 14,
    lengthRatio: 0.93,
    radiusRatio: 0.88,
    spreadAngle: 0.65,
    gravitySag: 0.85,
    trunkHeight: 3.4,
    trunkRadius: 0.58,
    numChildren: 4,
    gnarliness: 0.1,
    leafClusterDensity: 10,
  },
  sakura: {
    maxDepth: 5,
    lengthRatio: 0.82,
    radiusRatio: 0.72,
    spreadAngle: 0.88,
    gravitySag: 0.12,
    trunkHeight: 3.2,
    trunkRadius: 0.52,
    numChildren: 4,
    gnarliness: 0.2,
    leafClusterDensity: 14,
  },
  redwood: {
    maxDepth: 11,
    lengthRatio: 0.84,
    radiusRatio: 0.78,
    spreadAngle: 0.95,
    gravitySag: 0.05,
    trunkHeight: 6.2,
    trunkRadius: 0.68,
    numChildren: 4,
    gnarliness: 0.05,
    leafClusterDensity: 10,
  },
}

export interface ArchetypeMaterials {
  bark: THREE.MeshStandardMaterial
  joint: THREE.MeshStandardMaterial
  leaf: THREE.MeshStandardMaterial
  blossom: THREE.MeshStandardMaterial
  stamen: THREE.MeshStandardMaterial
  moteTexture: THREE.CanvasTexture
  petalTexture: THREE.CanvasTexture
  moteColor: THREE.Color
  petalColor: THREE.Color
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.7)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export class MaterialManager {
  private materials: Record<TreeArchetype, ArchetypeMaterials>
  readonly glowTexture = createGlowTexture()

  constructor() {
    this.materials = {
      oak: {
        bark: new THREE.MeshStandardMaterial({
          color: 0x3d2714,
          roughness: 0.88,
          metalness: 0.02,
        }),
        joint: new THREE.MeshStandardMaterial({
          color: 0x3d2714,
          roughness: 0.88,
        }),
        leaf: new THREE.MeshStandardMaterial({
          color: 0x15803d,
          roughness: 0.4,
          emissive: 0x052e16,
          emissiveIntensity: 0.15,
          side: THREE.DoubleSide,
        }),
        blossom: new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xca8a04,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          side: THREE.DoubleSide,
        }),
        stamen: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfef08a,
          emissiveIntensity: 0.8,
        }),
        moteTexture: this.glowTexture,
        petalTexture: this.glowTexture,
        moteColor: new THREE.Color(0x34d399),
        petalColor: new THREE.Color(0x10b981),
      },
      willow: {
        bark: new THREE.MeshStandardMaterial({
          color: 0x4a371e,
          roughness: 0.85,
        }),
        joint: new THREE.MeshStandardMaterial({
          color: 0x4a371e,
          roughness: 0.85,
        }),
        leaf: new THREE.MeshStandardMaterial({
          color: 0xeab308,
          roughness: 0.35,
          emissive: 0x713f12,
          emissiveIntensity: 0.2,
          side: THREE.DoubleSide,
        }),
        blossom: new THREE.MeshStandardMaterial({
          color: 0xfef9c3,
          emissive: 0xca8a04,
          emissiveIntensity: 0.45,
          side: THREE.DoubleSide,
        }),
        stamen: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfde047,
          emissiveIntensity: 0.8,
        }),
        moteTexture: this.glowTexture,
        petalTexture: this.glowTexture,
        moteColor: new THREE.Color(0xfde047),
        petalColor: new THREE.Color(0xeab308),
      },
      sakura: {
        bark: new THREE.MeshStandardMaterial({
          color: 0x2e182b,
          roughness: 0.82,
        }),
        joint: new THREE.MeshStandardMaterial({
          color: 0x2e182b,
          roughness: 0.82,
        }),
        leaf: new THREE.MeshStandardMaterial({
          color: 0xf472b6,
          roughness: 0.35,
          emissive: 0x831843,
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide,
        }),
        blossom: new THREE.MeshStandardMaterial({
          color: 0xfbcfe8,
          emissive: 0xdb2777,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
        }),
        stamen: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfbcfe8,
          emissiveIntensity: 0.8,
        }),
        moteTexture: this.glowTexture,
        petalTexture: this.glowTexture,
        moteColor: new THREE.Color(0xfbcfe8),
        petalColor: new THREE.Color(0xf472b6),
      },
      redwood: {
        bark: new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.7,
        }),
        joint: new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.7,
        }),
        leaf: new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.3,
          emissive: 0x0c4a6e,
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide,
        }),
        blossom: new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x0284c7,
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
        }),
        stamen: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x7dd3fc,
          emissiveIntensity: 0.8,
        }),
        moteTexture: this.glowTexture,
        petalTexture: this.glowTexture,
        moteColor: new THREE.Color(0x7dd3fc),
        petalColor: new THREE.Color(0x38bdf8),
      },
    }
  }

  get(archetype: TreeArchetype): ArchetypeMaterials {
    return this.materials[archetype]
  }
}
