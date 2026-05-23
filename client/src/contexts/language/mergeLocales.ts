// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeLocale(
  core: Record<string, any>,
  ...modules: Record<string, any>[]
): Record<string, any> {
  return Object.assign({}, core, ...modules);
}
