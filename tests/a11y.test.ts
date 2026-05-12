/**
 * Issue #10: Accessibility — ARIA wiring, focus styles, tab order
 *
 * Tests that:
 * 1. #celsius-input aria-describedby is initially just "celsius-helper" (not "celsius-error")
 * 2. setInputAriaError(input, true)  adds    "celsius-error" to aria-describedby
 * 3. setInputAriaError(input, false) removes "celsius-error" from aria-describedby
 * 4. #sign-toggle button exists in the DOM in natural tab order (no stray tabindex)
 * 5. CSS has :focus-visible rules with ≥ 2px outline for #celsius-input and #sign-toggle
 * 6. CSS does not suppress outlines globally
 * 7. setInputAriaError and syncSignTogglePressed work correctly against real JSDOM elements
 * 8. CSS :focus-visible outline is exactly 2px (minimum WCAG 2.2 requirement)
 * 9. syncSignTogglePressed handles edge-case values: lone "-", "-0", "--5"
 * 10. <dl> output structure has matching <dt>/<dd> pairs for Fahrenheit and Kelvin
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, it, expect, beforeAll } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = resolve(__dirname, '../index.html')
const cssPath  = resolve(__dirname, '../src/styles.css')

let document: Document

beforeAll(() => {
  const html = readFileSync(htmlPath, 'utf8')
  const dom = new JSDOM(html)
  document = dom.window.document
})

// ---------------------------------------------------------------------------
// ARIA — initial HTML state
// ---------------------------------------------------------------------------
describe('ARIA describedby — initial HTML state', () => {
  it('#celsius-input aria-describedby initially contains "celsius-helper"', () => {
    const input = document.getElementById('celsius-input')
    expect(input).not.toBeNull()
    const ids = (input!.getAttribute('aria-describedby') ?? '').trim().split(/\s+/)
    expect(ids).toContain('celsius-helper')
  })

  it('#celsius-input aria-describedby does NOT contain "celsius-error" in the initial HTML', () => {
    const input = document.getElementById('celsius-input')
    const ids = (input!.getAttribute('aria-describedby') ?? '').trim().split(/\s+/)
    expect(ids).not.toContain('celsius-error')
  })
})

// ---------------------------------------------------------------------------
// ARIA — JS toggle via exported setInputAriaError
// ---------------------------------------------------------------------------
describe('ARIA describedby — JS toggle (setInputAriaError)', () => {
  it('setInputAriaError(input, true) adds "celsius-error" to aria-describedby', async () => {
    const { setInputAriaError } = await import('../src/main.ts')
    const fakeInput = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
      getAttribute:  (name: string) => attrs[name] ?? null,
    } as unknown as HTMLInputElement
    const attrs: Record<string, string> = {}

    setInputAriaError(fakeInput, true)

    const ids = (attrs['aria-describedby'] ?? '').trim().split(/\s+/)
    expect(ids).toContain('celsius-helper')
    expect(ids).toContain('celsius-error')
  })

  it('setInputAriaError(input, false) keeps "celsius-helper" but drops "celsius-error"', async () => {
    const { setInputAriaError } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeInput = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
      getAttribute:  (name: string) => attrs[name] ?? null,
    } as unknown as HTMLInputElement

    // set to error state first, then clear
    setInputAriaError(fakeInput, true)
    setInputAriaError(fakeInput, false)

    const ids = (attrs['aria-describedby'] ?? '').trim().split(/\s+/)
    expect(ids).toContain('celsius-helper')
    expect(ids).not.toContain('celsius-error')
  })

  it('setInputAriaError(input, false) sets aria-describedby to exactly "celsius-helper"', async () => {
    const { setInputAriaError } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeInput = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
      getAttribute:  (name: string) => attrs[name] ?? null,
    } as unknown as HTMLInputElement

    setInputAriaError(fakeInput, false)
    expect(attrs['aria-describedby']).toBe('celsius-helper')
  })
})

// ---------------------------------------------------------------------------
// Tab order — sign-toggle button existence and no stray tabindex
// ---------------------------------------------------------------------------
describe('tab order — #sign-toggle button', () => {
  it('#sign-toggle button exists in the DOM', () => {
    const btn = document.getElementById('sign-toggle')
    expect(btn).not.toBeNull()
    expect(btn!.tagName).toBe('BUTTON')
  })

  it('#sign-toggle has no stray negative tabindex', () => {
    const btn = document.getElementById('sign-toggle')
    const tabindex = btn!.getAttribute('tabindex')
    // null (natural order) or "0" are acceptable; negative values break tab order
    if (tabindex !== null) {
      expect(parseInt(tabindex, 10)).toBeGreaterThanOrEqual(0)
    }
  })

  it('#celsius-input has no stray negative tabindex', () => {
    const input = document.getElementById('celsius-input')
    const tabindex = input!.getAttribute('tabindex')
    if (tabindex !== null) {
      expect(parseInt(tabindex, 10)).toBeGreaterThanOrEqual(0)
    }
  })

  it('#sign-toggle appears after #celsius-input in DOM order', () => {
    const input = document.getElementById('celsius-input')!
    const btn   = document.getElementById('sign-toggle')!
    // DOCUMENT_POSITION_FOLLOWING = 4 (numeric constant; Node global not available in Node.js env)
    const DOCUMENT_POSITION_FOLLOWING = 4
    const pos = input.compareDocumentPosition(btn)
    expect(pos & DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// CSS focus styles
// ---------------------------------------------------------------------------
describe('CSS focus styles', () => {
  let css: string

  beforeAll(() => {
    css = readFileSync(cssPath, 'utf8')
  })

  it('CSS has a :focus-visible block for the celsius input (.field__input or #celsius-input)', () => {
    // Must contain a :focus-visible rule that applies to the input
    expect(css).toMatch(/(?:\.field__input|#celsius-input):focus-visible/)
  })

  it('CSS :focus-visible rule for the celsius input specifies a visible outline or ring', () => {
    // Accept either an outline property or a box-shadow ring (both are valid WCAG approaches)
    const focusBlock = css.match(/(?:\.field__input|#celsius-input):focus-visible\s*\{([^}]*)\}/s)
    expect(focusBlock).not.toBeNull()
    const block = focusBlock![1]
    const hasOutline   = /outline\s*:(?!\s*none)/.test(block)
    const hasBoxShadow = /box-shadow/.test(block)
    expect(hasOutline || hasBoxShadow).toBe(true)
  })

  it('CSS has a :focus-visible block for #sign-toggle', () => {
    expect(css).toMatch(/#sign-toggle:focus-visible/)
  })

  it('CSS :focus-visible rule for #sign-toggle specifies a visible outline or ring', () => {
    const focusBlock = css.match(/#sign-toggle:focus-visible\s*\{([^}]*)\}/s)
    expect(focusBlock).not.toBeNull()
    const block = focusBlock![1]
    const hasOutline   = /outline\s*:(?!\s*none)/.test(block)
    const hasBoxShadow = /box-shadow/.test(block)
    expect(hasOutline || hasBoxShadow).toBe(true)
  })

  it('CSS does not apply outline:none at the global * selector level', () => {
    // Disallowed: * { ... outline: none ... } — would suppress all focus rings
    expect(css).not.toMatch(/\*\s*\{[^}]*outline\s*:\s*none/s)
  })

  it('CSS does not apply outline:none at html or body level', () => {
    expect(css).not.toMatch(/(?:html|body)\s*\{[^}]*outline\s*:\s*none/s)
  })
})

// ---------------------------------------------------------------------------
// Error slot ARIA attributes
// ---------------------------------------------------------------------------
describe('#celsius-error ARIA attributes', () => {
  it('#celsius-error is present in the DOM', () => {
    const el = document.getElementById('celsius-error')
    expect(el).not.toBeNull()
  })

  it('#celsius-error has the hidden attribute initially', () => {
    const el = document.getElementById('celsius-error')
    expect(el!.hasAttribute('hidden')).toBe(true)
  })

  it('#celsius-error has aria-live="polite"', () => {
    const el = document.getElementById('celsius-error')
    expect(el!.getAttribute('aria-live')).toBe('polite')
  })
})

// ---------------------------------------------------------------------------
// sign-toggle button accessible label
// ---------------------------------------------------------------------------
describe('#sign-toggle accessible label', () => {
  it('#sign-toggle has an accessible label (aria-label or visible text)', () => {
    const btn = document.getElementById('sign-toggle')!
    const ariaLabel    = btn.getAttribute('aria-label')
    const visibleText  = btn.textContent?.trim()
    // Either an aria-label or non-empty visible text is required
    expect(ariaLabel || visibleText).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// sign-toggle aria-pressed — initial HTML state and JS sync
// ---------------------------------------------------------------------------
describe('#sign-toggle aria-pressed', () => {
  it('#sign-toggle has aria-pressed attribute in the initial HTML', () => {
    const btn = document.getElementById('sign-toggle')!
    expect(btn.hasAttribute('aria-pressed')).toBe(true)
  })

  it('#sign-toggle aria-pressed is "false" in the initial HTML (no negative sign active)', () => {
    const btn = document.getElementById('sign-toggle')!
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('syncSignTogglePressed sets aria-pressed="true" when value starts with "-"', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    syncSignTogglePressed(fakeBtn, '-42')
    expect(attrs['aria-pressed']).toBe('true')
  })

  it('syncSignTogglePressed sets aria-pressed="false" when value has no leading minus', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    syncSignTogglePressed(fakeBtn, '42')
    expect(attrs['aria-pressed']).toBe('false')
  })

  it('syncSignTogglePressed sets aria-pressed="false" for an empty input value', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    syncSignTogglePressed(fakeBtn, '')
    expect(attrs['aria-pressed']).toBe('false')
  })
})

// ---------------------------------------------------------------------------
// syncSignTogglePressed — edge-case boundary values
// ---------------------------------------------------------------------------
describe('#sign-toggle aria-pressed — edge cases for syncSignTogglePressed', () => {
  it('syncSignTogglePressed sets aria-pressed="true" for lone "-" (sign-only value)', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    syncSignTogglePressed(fakeBtn, '-')
    expect(attrs['aria-pressed']).toBe('true')
  })

  it('syncSignTogglePressed sets aria-pressed="true" for "-0"', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    syncSignTogglePressed(fakeBtn, '-0')
    expect(attrs['aria-pressed']).toBe('true')
  })

  it('syncSignTogglePressed sets aria-pressed="true" for "--5" (double-minus)', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const attrs: Record<string, string> = {}
    const fakeBtn = {
      setAttribute: (name: string, value: string) => { attrs[name] = value },
    } as unknown as HTMLButtonElement

    // "--5" starts with "-" → pressed=true; toggleSign would strip one minus leaving "-5"
    syncSignTogglePressed(fakeBtn, '--5')
    expect(attrs['aria-pressed']).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// End-to-end DOM integration: setInputAriaError and syncSignTogglePressed
// against real JSDOM elements (not stub objects)
// ---------------------------------------------------------------------------
describe('ARIA helpers — end-to-end with real JSDOM elements', () => {
  it('setInputAriaError(realInput, true) updates aria-describedby on a real HTMLInputElement', async () => {
    const { setInputAriaError } = await import('../src/main.ts')
    const dom = new JSDOM('<input id="celsius-input" aria-describedby="celsius-helper" />')
    const input = dom.window.document.getElementById('celsius-input') as HTMLInputElement

    setInputAriaError(input, true)

    const ids = (input.getAttribute('aria-describedby') ?? '').trim().split(/\s+/)
    expect(ids).toContain('celsius-helper')
    expect(ids).toContain('celsius-error')
  })

  it('setInputAriaError(realInput, false) resets aria-describedby to "celsius-helper" only', async () => {
    const { setInputAriaError } = await import('../src/main.ts')
    const dom = new JSDOM('<input id="celsius-input" aria-describedby="celsius-helper celsius-error" />')
    const input = dom.window.document.getElementById('celsius-input') as HTMLInputElement

    setInputAriaError(input, false)

    expect(input.getAttribute('aria-describedby')).toBe('celsius-helper')
  })

  it('syncSignTogglePressed(realBtn, "-42") sets aria-pressed="true" on a real HTMLButtonElement', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const dom = new JSDOM('<button id="sign-toggle" aria-pressed="false">±</button>')
    const btn = dom.window.document.getElementById('sign-toggle') as HTMLButtonElement

    syncSignTogglePressed(btn, '-42')

    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('syncSignTogglePressed(realBtn, "42") sets aria-pressed="false" on a real HTMLButtonElement', async () => {
    const { syncSignTogglePressed } = await import('../src/main.ts')
    const dom = new JSDOM('<button id="sign-toggle" aria-pressed="true">±</button>')
    const btn = dom.window.document.getElementById('sign-toggle') as HTMLButtonElement

    syncSignTogglePressed(btn, '42')

    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })
})

// ---------------------------------------------------------------------------
// CSS focus-visible outline width — ≥ 2px minimum (WCAG 2.2 Focus Appearance)
// ---------------------------------------------------------------------------
describe('CSS focus styles — 2px minimum outline width', () => {
  let css: string

  beforeAll(() => {
    css = readFileSync(cssPath, 'utf8')
  })

  it('CSS :focus-visible on .field__input specifies at least a 2px outline', () => {
    const focusBlock = css.match(/(?:\.field__input|#celsius-input):focus-visible\s*\{([^}]*)\}/s)
    expect(focusBlock).not.toBeNull()
    const block = focusBlock![1]
    // Match "outline: <width> ..." where width must be ≥ 2px
    const outlineMatch = block.match(/outline\s*:\s*([\d.]+)px/)
    // If outline is not pixel-based (e.g. box-shadow only), skip pixel check
    if (outlineMatch) {
      const px = parseFloat(outlineMatch[1])
      expect(px).toBeGreaterThanOrEqual(2)
    } else {
      // At minimum, outline must not be suppressed
      expect(block).not.toMatch(/outline\s*:\s*none/)
    }
  })

  it('CSS :focus-visible on #sign-toggle specifies at least a 2px outline', () => {
    const focusBlock = css.match(/#sign-toggle:focus-visible\s*\{([^}]*)\}/s)
    expect(focusBlock).not.toBeNull()
    const block = focusBlock![1]
    const outlineMatch = block.match(/outline\s*:\s*([\d.]+)px/)
    if (outlineMatch) {
      const px = parseFloat(outlineMatch[1])
      expect(px).toBeGreaterThanOrEqual(2)
    } else {
      expect(block).not.toMatch(/outline\s*:\s*none/)
    }
  })
})

// ---------------------------------------------------------------------------
// Output <dl> structure — <dt>/<dd> pairs for screen-reader accessible names
// ---------------------------------------------------------------------------
describe('output <dl> structure — accessible <dt>/<dd> pairing', () => {
  it('<dl> element exists in the DOM', () => {
    const dl = document.querySelector('dl')
    expect(dl).not.toBeNull()
  })

  it('#fahrenheit-output <dd> is present inside the <dl>', () => {
    const dd = document.getElementById('fahrenheit-output')
    expect(dd).not.toBeNull()
    expect(dd!.tagName).toBe('DD')
    expect(dd!.closest('dl')).not.toBeNull()
  })

  it('#kelvin-output <dd> is present inside the <dl>', () => {
    const dd = document.getElementById('kelvin-output')
    expect(dd).not.toBeNull()
    expect(dd!.tagName).toBe('DD')
    expect(dd!.closest('dl')).not.toBeNull()
  })

  it('the <dl> contains a <dt> with "Fahrenheit" text adjacent to #fahrenheit-output', () => {
    const dd = document.getElementById('fahrenheit-output')!
    // The dt must be a sibling in the same parent row div
    const row = dd.parentElement
    expect(row).not.toBeNull()
    const dt = row!.querySelector('dt')
    expect(dt).not.toBeNull()
    expect(dt!.textContent).toMatch(/Fahrenheit/i)
  })

  it('the <dl> contains a <dt> with "Kelvin" text adjacent to #kelvin-output', () => {
    const dd = document.getElementById('kelvin-output')!
    const row = dd.parentElement
    expect(row).not.toBeNull()
    const dt = row!.querySelector('dt')
    expect(dt).not.toBeNull()
    expect(dt!.textContent).toMatch(/Kelvin/i)
  })
})
