/** Public types for the ShippingContainer component. */

export type ContainerSize = "20ft" | "40ft";
export type EffectName = "hero" | "carousel" | "scroll" | "exploded";
export type ColorZone = "body" | "doors" | "decals" | "interior";
export type Quality = "high" | "medium" | "low";

/** Any CSS colour the parser understands: hex, rgb()/rgba(), hsl()/hsla(). */
export type ColorInput = string;

export interface ZoneColors {
  body?: ColorInput;
  doors?: ColorInput;
  decals?: ColorInput;
  interior?: ColorInput;
}

/** Durations and easings are options, never hard-coded (brief: Motion rules). */
export interface MotionOptions {
  introDuration?: number;
  introEase?: string;
  doorDuration?: number;
  doorEase?: string;
  doorStagger?: number;
  colorDuration?: number;
  orbitEase?: string;
  tiltMax?: number;
}

export interface ContainerOptions {
  size?: ContainerSize;
  colors?: ZoneColors;
  effect?: EffectName;
  weathering?: boolean;
  /** Carousel autoplay interval in seconds. 0 disables it. */
  autoplay?: number;
  quality?: Quality;
  /** Initial orbit in degrees, measured from the front three-quarter view. */
  orbit?: number;
  /** Camera pitch in degrees; positive looks down on the box. Default 7. */
  pitch?: number;
  motion?: MotionOptions;
  onOpen?: () => void;
  onClose?: () => void;
  onChange?: (detail: { index: number; total: number }) => void;
}

export interface SetColorOptions {
  zone?: ColorZone;
  duration?: number;
  ease?: string;
}

export interface ContentSlots {
  side?: string;
  interior?: string;
}
