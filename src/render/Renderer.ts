import * as THREE from 'three'

export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87ceeb')

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2)
    sun.position.set(80, 120, 60)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -200
    sun.shadow.camera.right = 200
    sun.shadow.camera.top = 200
    sun.shadow.camera.bottom = -200
    this.scene.add(sun)

    window.addEventListener('resize', this.onResize)
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera)
  }

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
