/**
 * src/main.ts — DOM wiring for the temperature converter (issue #10: ARIA)
 *
 * Exports pure helper functions so unit tests can exercise them without a
 * real DOM.  The `initDom()` call at the bottom wires everything up when
 * loaded in a browser.
 *
 * Iteration 2: #sign-toggle now tracks its toggled state via aria-pressed so
 * that screen readers can announce "Toggle negative sign — pressed / not pressed".
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
 *
 * The value is trimmed before inspection so that whitespace-only strings are
 * treated identically to the empty string (both yield '-'), and a sign-only
 * value like '-   ' strips to the empty string rather than returning trailing
 * whitespace.
 */
export function toggleSign(currentValue: string): string {
  const trimmed = currentValue.trim()
  if (trimmed.startsWith('-')) return trimmed.slice(1)
  if (trimmed === '') return '-'
  return '-' + trimmed
}

/**
 * Synchronise the aria-pressed attribute on #sign-toggle to match whether
 * the current input value starts with a minus sign.
 *
 *   value starts with '-' → aria-pressed="true"   (sign is active / pressed)
 *   otherwise             → aria-pressed="false"  (sign is not active)
 *
 * This lets screen readers announce "Toggle negative sign — pressed" when the
 * negative sign is active, rather than leaving state entirely implicit.
 */
export function syncSignTogglePressed(
  button: HTMLButtonElement,
  inputValue: string,
): void {
  button.setAttribute('aria-pressed', inputValue.startsWith('-') ? 'true' : 'false')
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
      syncSignTogglePressed(signToggle, input.value)
      input.dispatchEvent(new Event('input'))
      input.focus()
    })

    // Keep aria-pressed in sync when the user edits the input directly
    // (e.g. types a minus sign or deletes it by hand).
    input.addEventListener('input', () => {
      syncSignTogglePressed(signToggle, input.value)
    })
  }

  // Listen for a CustomEvent instead of exposing a global function.
  // The validation layer (issue #7) should dispatch:
  //   document.dispatchEvent(new CustomEvent('celsius-error', { detail: { hasError: true, message: '...' } }))
  // This avoids polluting the window namespace and prevents any caller from
  // directly manipulating the ARIA error state via a window-level handle.
  //
  // Defensive guard: if `detail` is null/undefined (malformed dispatch), or
  // `hasError` is not present, we silently ignore the event.  Crashing inside
  // an event callback would produce an unhandled error but leave ARIA state
  // stale — the guard is strictly safer.
  if (input && errorEl) {
    document.addEventListener('celsius-error', (evt: Event) => {
      const detail = (evt as CustomEvent<unknown>).detail
      if (detail === null || detail === undefined || typeof detail !== 'object') return
      const { hasError, message } = detail as { hasError?: unknown; message?: unknown }
      // If hasError is not explicitly a boolean true, treat as no error
      const isError = hasError === true
      setInputAriaError(input, isError)
      if (isError) {
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
