/** A workplace resource that can be attached to a space (Deskbee-style amenity). */
export interface SpaceAmenity {
  key: string;
  label: string;
  icon: string;
}

/**
 * Canonical amenities offered in the UI. The backend stores amenities as free
 * strings, so an unknown key still renders (with a generic icon) instead of
 * breaking the map.
 */
export const SPACE_AMENITY_CATALOG: SpaceAmenity[] = [
  { key: 'monitor', label: 'Monitor externo', icon: 'desktop_windows' },
  { key: 'dual_monitor', label: 'Dois monitores', icon: 'desktop_windows' },
  { key: 'dock', label: 'Docking station', icon: 'dock' },
  { key: 'standing_desk', label: 'Mesa regulável', icon: 'height' },
  { key: 'ergonomic_chair', label: 'Cadeira ergonômica', icon: 'chair' },
  { key: 'window', label: 'Perto da janela', icon: 'window' },
  { key: 'whiteboard', label: 'Quadro branco', icon: 'edit_note' },
  { key: 'power', label: 'Tomadas extras', icon: 'power' },
  { key: 'quiet', label: 'Área silenciosa', icon: 'volume_off' },
  { key: 'locker', label: 'Armário', icon: 'lock' },
  { key: 'printer', label: 'Impressora próxima', icon: 'print' },
  { key: 'kitchen', label: 'Perto da copa', icon: 'local_cafe' },
  { key: 'accessibility', label: 'Acessível', icon: 'accessible' },
];

const BY_KEY = new Map(SPACE_AMENITY_CATALOG.map((amenity) => [amenity.key, amenity]));

/** Human label for an amenity key (falls back to the raw key). */
export function amenityLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

/** Material icon for an amenity key (falls back to a generic check). */
export function amenityIcon(key: string): string {
  return BY_KEY.get(key)?.icon ?? 'check_circle';
}

