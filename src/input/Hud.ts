// The readouts and the status used to live in the toolbar, which made the bar
// wide enough to push its own buttons off a 1440px screen - and a button past
// the right edge is unclickable, not merely ugly, since the bar is fixed
// inside a body with overflow:hidden. The two text spans were 49% of that
// width, as much as all ten controls, so they moved here. Placed under the
// toolbar by `stackTopLeft`, so it places nothing itself.
const HUD_STYLE =
  'color:#fff;font:14px/1.5 monospace;' +
  'background:rgba(0,0,0,0.45);padding:6px 10px;border-radius:6px;' +
  'pointer-events:none;user-select:none;white-space:pre'

export class Hud {
  readonly element: HTMLDivElement

  private readonly readouts: HTMLDivElement
  private readonly status: HTMLDivElement

  constructor() {
    this.element = document.createElement('div')
    this.element.style.cssText = HUD_STYLE

    this.readouts = document.createElement('div')
    this.readouts.dataset.role = 'readouts'
    this.element.appendChild(this.readouts)

    this.status = document.createElement('div')
    this.status.dataset.role = 'status'
    this.status.style.color = '#ffd479'
    // No inline display: `hidden` has to be free to take it out of flow, and
    // an inline display would beat the UA stylesheet's [hidden] rule.
    this.status.hidden = true
    this.element.appendChild(this.status)
  }

  setReadouts(text: string): void {
    this.readouts.textContent = text
  }

  // Its own element rather than part of the readouts: Game rewrites those
  // every frame, which would wipe a message before it was read.
  setStatus(text: string): void {
    this.status.textContent = text
    this.status.hidden = text === ''
  }
}
