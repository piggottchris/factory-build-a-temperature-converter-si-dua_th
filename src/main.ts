/**
 * src/main.ts — DOM wiring for the temperature converter (issue #10: ARIA)
 *
 * Exports pure helper functions so unit tests can exercise them without a
 * real DOM.  The `initDom()` call at the bottom wires everything up when
 * loaded in a browser.
 */

// ---------------------------------------------------------------------------
// Exported helpers (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Update #celsius-input's aria-describedby to include or exclude
 * the error-slot ID depending on whether an error is active.
 *
 *   hasError = false → aria-describedby="celsius-helper"
 *   hasError = true  → aria-describedby="celsius-helper celsius-error"
 *
 * The helper-text ID is always retained so screen readers can always access
 * the usage hint regardless of validation state.
 */
export function setInputAriaError(
  input: HTMLInputElement,
  hasError: boolean,
): void {
  input.setAttribute(
    'aria-describedby',
    hasError ? 'celsius-helper celsius-error' : 'celsius-helper',
  )
}

/**
 * Toggle a leading minus sign on the input value.
 *
 *   '-42' → '42'
 *   '42'  → '-42'
 *   ''    → '-'    (start a negative entry)
 */
export function toggleSign(currentValue: string): string {
  if (currentValue.startsWith('-')) return currentValue.slice(1)
  if (currentValue === '') return '-'
  return '-' + currentValue
}

// ---------------------------------------------------------------------------
// Browser-side wiring — skipped when imported in Node / vitest
// ---------------------------------------------------------------------------

function initDom(): void {
  const input     = document.querySelector<HTMLInputElement>('#celsius-input')
  const errorEl   = document.querySelector<HTMLElement>('#celsius-error')
  const signToggle = document.querySelector<HTMLButtonElement>('#sign-toggle')

  // Initialise aria-describedby to no-error state
  if (input) {
    setInputAriaError(input, false)
  }

  // ± button handler
  if (input && signToggle) {
    signToggle.addEventListener('click', () => {
      input.value = toggleSign(input.value)
      input.dispatchEvent(new Event('input'))
      input.focus()
    })
  }

  // Listen for a CustomEvent instead of exposing a global function.
  // The validation layer (issue #7) should dispatch:
  //   document.dispatchEvent(new CustomEvent('celsius-error', { detail: { hasError: true, message: '...' } }))
  // This avoids polluting the window namespace and prevents any caller from
  // directly manipulating the ARIA error state via a window-level handle.
  if (input && errorEl) {
    document.addEventListener('celsius-error', (evt: Event) => {
      const { hasError, message } = (evt as CustomEvent<{ hasError: boolean; message?: string }>).detail
      setInputAriaError(input, hasError)
      if (hasError) {
        errorEl.textContent = typeof message === 'string' ? message : ''
        errorEl.removeAttribute('hidden')
      } else {
        errorEl.setAttribute('hidden', '')
        errorEl.textContent = ''
      }
    })
  }
}

if (typeof document !== 'undefined') {
  initDom()
}
