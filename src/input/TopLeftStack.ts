// The toolbar wraps, so its height is not a constant, and anything meant to
// sit directly under it has to follow it in flow rather than guess a `top`.
// The column passes clicks through: it is as wide as the toolbar, and the
// space beside a narrower child is beach. Children opt back in themselves.
const STACK_STYLE =
  'position:fixed;top:12px;left:12px;display:flex;flex-direction:column;' +
  'align-items:flex-start;gap:6px;pointer-events:none;z-index:10'

export function stackTopLeft(...elements: HTMLElement[]): HTMLDivElement {
  const stack = document.createElement('div')
  stack.style.cssText = STACK_STYLE
  for (const element of elements) stack.appendChild(element)
  return stack
}
