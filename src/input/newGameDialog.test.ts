import { describe, it, expect, afterEach } from 'vitest'
import { NewGameDialog } from './NewGameDialog.ts'
import type { NewGameChoice } from '../core/NewGame.ts'

const choiceRadio = (dialog: NewGameDialog, kind: string): HTMLInputElement =>
  dialog.element.querySelector<HTMLInputElement>(`input[type="radio"][value="${kind}"]`)!

const choose = (dialog: NewGameDialog, kind: string): void => {
  const radio = choiceRadio(dialog, kind)
  radio.checked = true
  radio.dispatchEvent(new Event('change', { bubbles: true }))
}

const seedField = (dialog: NewGameDialog): HTMLInputElement =>
  dialog.element.querySelector<HTMLInputElement>('input[data-role="seed"]')!

const typeSeed = (dialog: NewGameDialog, text: string): void => {
  const field = seedField(dialog)
  field.value = text
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

const button = (dialog: NewGameDialog, action: string): HTMLButtonElement =>
  dialog.element.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!

const press = (target: EventTarget, key: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

// The dialog in the document, as the game will have it, with every choice it
// reports collected.
const listening: (() => void)[] = []
afterEach(() => {
  listening.splice(0).forEach((stop) => stop())
  document.body.replaceChildren()
})

function aDialog(current: string | null = 'salty-gull-42') {
  const dialog = new NewGameDialog()
  document.body.appendChild(dialog.element)
  const chosen: NewGameChoice[] = []
  dialog.onChoose((choice) => chosen.push(choice))
  dialog.open(current)
  return { dialog, chosen }
}

describe('NewGameDialog', () => {
  it('starts closed', () => {
    const dialog = new NewGameDialog()

    expect(dialog.isOpen).toBe(false)
    expect(dialog.element.style.display).toBe('none')
  })

  it('shows itself when opened', () => {
    const { dialog } = aDialog()

    expect(dialog.isOpen).toBe(true)
    expect(dialog.element.style.display).not.toBe('none')
  })

  it('offers the four ways to start', () => {
    const { dialog } = aDialog()

    for (const kind of ['classic', 'restart', 'random', 'chosen']) {
      expect(choiceRadio(dialog, kind)).not.toBeNull()
    }
  })

  // "Restart this beach" means nothing unless the player can see which beach.
  it('names the beach a restart would bring back', () => {
    expect(aDialog('salty-gull-42').dialog.element.textContent).toContain('salty-gull-42')
    expect(aDialog(null).dialog.element.textContent).toMatch(/classic/i)
  })

  it('starts a random beach unless told otherwise', () => {
    const { dialog, chosen } = aDialog()

    button(dialog, 'start').click()

    expect(chosen).toEqual([{ kind: 'random' }])
  })

  it('reports each choice the player makes', () => {
    for (const kind of ['classic', 'restart', 'random'] as const) {
      const { dialog, chosen } = aDialog()
      choose(dialog, kind)

      button(dialog, 'start').click()

      expect(chosen).toEqual([{ kind }])
    }
  })

  it('reports the seed the player typed', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')
    typeSeed(dialog, 'my beach')

    button(dialog, 'start').click()

    expect(chosen).toEqual([{ kind: 'chosen', text: 'my beach' }])
  })

  it('closes once a choice is made', () => {
    const { dialog } = aDialog()

    button(dialog, 'start').click()

    expect(dialog.isOpen).toBe(false)
    expect(dialog.element.style.display).toBe('none')
  })

  it('only takes a seed when the player is choosing one', () => {
    const { dialog } = aDialog()
    expect(seedField(dialog).disabled).toBe(true)

    choose(dialog, 'chosen')
    expect(seedField(dialog).disabled).toBe(false)

    choose(dialog, 'classic')
    expect(seedField(dialog).disabled).toBe(true)
  })

  it('will not start on a seed that is empty or only spaces', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')
    expect(button(dialog, 'start').disabled).toBe(true)

    typeSeed(dialog, '   ')
    expect(button(dialog, 'start').disabled).toBe(true)

    typeSeed(dialog, 'gull')
    expect(button(dialog, 'start').disabled).toBe(false)

    choose(dialog, 'random')
    typeSeed(dialog, '')
    expect(button(dialog, 'start').disabled).toBe(false)
    expect(chosen).toEqual([])
  })

  it('starts on Enter in the seed field', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')
    typeSeed(dialog, 'gull')

    press(seedField(dialog), 'Enter')

    expect(chosen).toEqual([{ kind: 'chosen', text: 'gull' }])
  })

  it('does not start on Enter while the seed is empty', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')

    press(seedField(dialog), 'Enter')

    expect(chosen).toEqual([])
    expect(dialog.isOpen).toBe(true)
  })

  it('closes without a choice on Cancel', () => {
    const { dialog, chosen } = aDialog()

    button(dialog, 'cancel').click()

    expect(dialog.isOpen).toBe(false)
    expect(chosen).toEqual([])
  })

  it('closes without a choice on Escape', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')

    press(seedField(dialog), 'Escape')

    expect(dialog.isOpen).toBe(false)
    expect(chosen).toEqual([])
  })

  // The game's keys listen on window: typing "r" into the seed field would
  // otherwise reset the water, "n" reopen this dialog and "s" pick the Spade.
  it('keeps the keys typed into it from reaching the game', () => {
    const { dialog } = aDialog()
    choose(dialog, 'chosen')
    const heard: string[] = []
    const listener = (e: KeyboardEvent) => heard.push(e.key)
    window.addEventListener('keydown', listener)
    listening.push(() => window.removeEventListener('keydown', listener))

    for (const key of ['r', 'n', 's', 'p', 'Escape']) press(seedField(dialog), key)

    expect(heard).toEqual([])
  })

  it('opens afresh each time, not where the last visit left it', () => {
    const { dialog, chosen } = aDialog()
    choose(dialog, 'chosen')
    typeSeed(dialog, 'gull')
    button(dialog, 'cancel').click()

    dialog.open(null)
    button(dialog, 'start').click()

    expect(seedField(dialog).value).toBe('')
    expect(chosen).toEqual([{ kind: 'random' }])
  })
})
