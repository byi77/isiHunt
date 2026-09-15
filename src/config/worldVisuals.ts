/** Nur Darstellung: keine Freischaltungen, Belohnungen oder Weltregeln. */
export const WORLD_VISUALS = [
  { surface: 'land', dark: 0x174e55, light: 0x91bea0, rim: 0xa0dfc5, ring: 'none', tilt: -0.2 },
  { surface: 'ice', dark: 0x2a5276, light: 0xd5edee, rim: 0xc0f0ff, ring: 'ice', tilt: -0.3 },
  { surface: 'gas', dark: 0x6d2420, light: 0xe7a66e, rim: 0xe9bd98, ring: 'none', tilt: 0.2 },
  { surface: 'void', dark: 0x101021, light: 0x686887, rim: 0xc3b9db, ring: 'rift', tilt: -0.6 },
  { surface: 'sun', dark: 0x845627, light: 0xffe1a2, rim: 0xffdfaa, ring: 'corona', tilt: 0 },
  { surface: 'moon', dark: 0x303d57, light: 0xb4bbc5, rim: 0xbecfe4, ring: 'moons', tilt: 0.25 },
  { surface: 'crystal', dark: 0x1b455c, light: 0x92d8df, rim: 0xc7f3f1, ring: 'ice', tilt: 0.4 },
  { surface: 'storm', dark: 0x393149, light: 0xb7a8c9, rim: 0xd9c4e8, ring: 'none', tilt: -0.3 },
  { surface: 'core', dark: 0x8c4622, light: 0xffefbc, rim: 0xffe5ac, ring: 'corona', tilt: 0 },
  { surface: 'gate', dark: 0x262b52, light: 0x939dcc, rim: 0xd0d9fa, ring: 'gate', tilt: -0.48 },
] as const;

export type WorldVisual = (typeof WORLD_VISUALS)[number];
export const PLANET_RENDER = { resolution: 128, frames: 24, rotationMs: 90_000 } as const;

export function worldVisual(variant: number): WorldVisual {
  return WORLD_VISUALS[variant] ?? WORLD_VISUALS[0];
}
