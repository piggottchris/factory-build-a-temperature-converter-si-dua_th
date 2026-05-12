// Temperature conversion pure functions — implemented in issue #2
export type ParseResult =
  | { state: 'empty' }
  | { state: 'pending' }
  | { state: 'valid'; value: number }
  | { state: 'invalid'; reason: 'format' | 'range' }

export function parseCelsius(_raw: string): ParseResult {
  return { state: 'empty' }
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32
}

export function celsiusToKelvin(c: number): number {
  return c + 273.15
}

export function formatNumber(n: number): string {
  const abs     = Math.abs(n)
  const rounded = Math.sign(n === 0 ? 1 : n) * (Math.round(abs * 100) / 100)
  return rounded.toFixed(2)
}
