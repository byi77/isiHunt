/** Pure presentation: never feeds back into movement or collection geometry. */
export interface ShipFlightPose {
  bank: number;
  pitch: number;
}

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

export function shipFlightPose(
  previous: ShipFlightPose,
  horizontalSpeed: number,
  acceleration: number,
  deltaSeconds: number,
  reducedMotion = false,
): ShipFlightPose {
  if (reducedMotion) return { bank: 0, pitch: 0 };
  const blend = 1 - Math.exp(-8 * Math.max(0, deltaSeconds));
  return {
    bank: previous.bank + (clamp(horizontalSpeed) * 0.32 - previous.bank) * blend,
    pitch: previous.pitch + (clamp(acceleration) * 0.18 - previous.pitch) * blend,
  };
}

/** Local engine position, transformed with the visible hull. */
export function shipExhaustOffset(rotation: number, scaleY: number): { x: number; y: number } {
  const tail = 36 * scaleY;
  return { x: -Math.sin(rotation) * tail, y: Math.cos(rotation) * tail };
}
