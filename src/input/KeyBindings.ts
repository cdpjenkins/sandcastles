import { ToolMode } from './Tools.ts'

const TOOL_KEYS: Record<string, ToolMode> = {
  d: ToolMode.Dump,
  s: ToolMode.Spade,
  w: ToolMode.Stream,
}

export function toolForKey(key: string): ToolMode | null {
  return TOOL_KEYS[key.toLowerCase()] ?? null
}
