export type KeyModifier = 'ctrl' | 'shift' | 'alt' | 'meta';

export interface Shortcut {
  key: string;
  modifiers?: KeyModifier[];
  description: string;
  action: () => void;
}
