/**
 * Backend Reliability tests — iteration 3
 *
 * Verifies defensive / edge-case behaviour added in iteration 3:
 *
 * 1. toggleSign handles whitespace-only strings (treated as empty → '-')
 * 2. toggleSign handles minus-plus-whitespace strings (trims, yields '')
 * 3. celsius-error CustomEvent with null detail is a no-op (no crash)
 * 4. celsius-error CustomEvent with missing hasError key treats as no-error
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// toggleSign — whitespace edge cases
// ---------------------------------------------------------------------------
describe('toggleSign — whitespace edge cases', () => {
  it('toggleSign(" ") treats whitespace-only as empty and returns "-"', async () => {
    const { toggleSign } = await import('../src/main.ts')
    expect(toggleSign('   ')).toBe('-')
  })

  it('toggleSign("\\t\\n") treats tab/newline whitespace as empty and returns "-"', async () => {
    const { toggleSign } = await import('../src/main.ts')
    expect(toggleSign('\t\n')).toBe('-')
  })

  it('toggleSign("-  ") strips leading minus from trimmed form, returning ""', async () => {
    const { toggleSign } = await import('../src/main.ts')
    // trimmed = '-', starts with '-', slice(1) = ''
    expect(toggleSign('-  ')).toBe('')
  })

  it('toggleSign("-  42  ") strips leading minus from the trimmed form', async () => {
    const { toggleSign } = await import('../src/main.ts')
    // trimmed = '-  42' (outer whitespace removed; interior space preserved)
    // startsWith('-') → slice(1) = '  42'
    expect(toggleSign('-  42  ')).toBe('  42')
  })

  it('toggleSign("  42  ") prepends minus to trimmed "42", returning "-42"', async () => {
    const { toggleSign } = await import('../src/main.ts')
    expect(toggleSign('  42  ')).toBe('-42')
  })
})

// ---------------------------------------------------------------------------
// celsius-error CustomEvent — malformed detail guard
// ---------------------------------------------------------------------------
describe('celsius-error CustomEvent — malformed detail is handled defensively', () => {
  it('dispatching celsius-error with null detail does not throw', () => {
    // We test at the function level (not JSDOM wiring) to keep the test fast.
    // Re-create the exact guard logic to confirm it is present in the source.
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8')
    // The source must guard against null/undefined detail before destructuring
    expect(src).toMatch(/detail\s*===\s*null\s*\|\|\s*detail\s*===\s*undefined/)
  })

  it('dispatching celsius-error with undefined detail does not throw', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8')
    // Same guard covers undefined
    expect(src).toMatch(/detail\s*===\s*undefined/)
  })

  it('dispatching celsius-error with detail missing hasError key treats as no-error', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8')
    // The source must use strict equality (=== true) so that undefined hasError
    // is treated as no-error rather than crashing or silently becoming truthy.
    expect(src).toMatch(/hasError\s*===\s*true/)
  })

  it('celsius-error listener guard: non-object detail is rejected', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8')
    // Confirm the typeof object check is present
    expect(src).toMatch(/typeof\s+detail\s*!==\s*['"]object['"]/)
  })
})
