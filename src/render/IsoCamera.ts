import * as THREE from 'three'
import { ISO_ANGLE_X, ISO_ANGLE_Y } from './isoProjection.ts'

const MIN_ZOOM = 20
const MAX_ZOOM = 300
const PAN_SPEED = 0.5
const ZOOM_SPEED = 1.08

export class IsoCamera {
  readonly camera: THREE.OrthographicCamera

  private zoom = 80
  private panTarget = new THREE.Vector3(128, 0, 128)

  constructor(canvas: HTMLCanvasElement) {
    const aspect = canvas.clientWidth / canvas.clientHeight
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect,
      this.zoom * aspect,
      this.zoom,
      -this.zoom,
      0.1,
      1000,
    )

    this.updateCameraPosition()

    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('resize', () => this.onResize(canvas))
  }

  private updateCameraPosition(): void {
    const dist = 300
    this.camera.position.set(
      this.panTarget.x + dist * Math.sin(ISO_ANGLE_Y) * Math.cos(ISO_ANGLE_X),
      this.panTarget.y + dist * Math.sin(ISO_ANGLE_X),
      this.panTarget.z + dist * Math.cos(ISO_ANGLE_Y) * Math.cos(ISO_ANGLE_X),
    )
    this.camera.lookAt(this.panTarget)
    this.camera.updateProjectionMatrix()
  }

  private updateFrustum(canvas: HTMLCanvasElement): void {
    const aspect = canvas.clientWidth / canvas.clientHeight
    this.camera.left = -this.zoom * aspect
    this.camera.right = this.zoom * aspect
    this.camera.top = this.zoom
    this.camera.bottom = -this.zoom
    this.camera.updateProjectionMatrix()
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()

    if (e.ctrlKey) {
      // Pinch gesture on trackpad (or Ctrl+scroll)
      const factor = e.deltaY > 0 ? ZOOM_SPEED : 1 / ZOOM_SPEED
      this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor))
      this.updateFrustum(e.target as HTMLCanvasElement)
    } else {
      // Two-finger drag on trackpad
      const scale = (this.zoom / 100) * PAN_SPEED
      const dx = e.deltaX
      const dy = e.deltaY
      this.panTarget.x += (dx * Math.cos(ISO_ANGLE_Y) + dy * Math.sin(ISO_ANGLE_Y)) * scale
      this.panTarget.z += (-dx * Math.sin(ISO_ANGLE_Y) + dy * Math.cos(ISO_ANGLE_Y)) * scale
      this.updateCameraPosition()
    }
  }

  private onResize = (canvas: HTMLCanvasElement): void => {
    this.updateFrustum(canvas)
  }
}
