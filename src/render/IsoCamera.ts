import * as THREE from 'three'

const ISO_ANGLE_Y = Math.PI / 4
const ISO_ANGLE_X = Math.atan(1 / Math.sqrt(2))

const MIN_ZOOM = 20
const MAX_ZOOM = 300
const PAN_SPEED = 0.5
const ZOOM_SPEED = 1.1

export class IsoCamera {
  readonly camera: THREE.OrthographicCamera

  private zoom = 80
  private panTarget = new THREE.Vector3(128, 0, 128)
  private isDragging = false
  private lastPointer = { x: 0, y: 0 }

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
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)

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
    this.zoom *= e.deltaY > 0 ? ZOOM_SPEED : 1 / ZOOM_SPEED
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom))
    this.updateFrustum(e.target as HTMLCanvasElement)
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 1 || e.button === 2) {
      this.isDragging = true
      this.lastPointer = { x: e.clientX, y: e.clientY }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return

    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y
    this.lastPointer = { x: e.clientX, y: e.clientY }

    const scale = (this.zoom / 100) * PAN_SPEED
    this.panTarget.x -= (dx * Math.cos(ISO_ANGLE_Y) + dy * Math.sin(ISO_ANGLE_Y)) * scale
    this.panTarget.z -= (-dx * Math.sin(ISO_ANGLE_Y) + dy * Math.cos(ISO_ANGLE_Y)) * scale

    this.updateCameraPosition()
  }

  private onPointerUp = (e: PointerEvent): void => {
    this.isDragging = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  private onResize = (canvas: HTMLCanvasElement): void => {
    this.updateFrustum(canvas)
  }
}
