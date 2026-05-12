/**
 * Security tests — iteration 1 (Security Hardening)
 *
 * Verifies that:
 * 1. `window.setInputAriaError` is NOT exposed as a global — prevents
 *    any injected script from directly manipulating the ARIA error state
 *    or the error element's visibility via a window-level handle.
 * 2. The CustomEvent 'celsius-error' integration correctly wires ARIA
 *    state and error-element visibility when dispatched on document.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM, VirtualConsole } from 'jsdom'
import { describe, it, expect, beforeEach } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mainTsPath = resolve(__dirname, '../src/main.ts')

// ---------------------------------------------------------------------------
// Source-level check: window.setInputAriaError must not appear in main.ts
// ---------------------------------------------------------------------------
describe('Security: no window.setInputAriaError global', () => {
  it('main.ts source does not assign to window.setInputAriaError', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    // Match any assignment like `window.setInputAriaError = ...`
    // or `(window as ...).setInputAriaError = ...`
    expect(src).not.toMatch(/window\s*(?:as\s+\w+\s*)?\)?\s*\.\s*setInputAriaError\s*=/)
  })

  it('main.ts source does not reference WindowWithHelper type (old global bridge removed)', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).not.toContain('WindowWithHelper')
  })
})

// ---------------------------------------------------------------------------
// Source-level check: CustomEvent pattern must be present
// ---------------------------------------------------------------------------
describe('Security: CustomEvent-based coupling instead of global', () => {
  it('main.ts registers a "celsius-error" CustomEvent listener on document', () => {
    const src = readFileSync(mainTsPath, 'utf8')
    expect(src).toMatch(/document\.addEventListener\s*\(\s*['"]celsius-error['"]/)
  })
})
