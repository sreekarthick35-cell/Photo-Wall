export type FrameColor = 'blue' | 'green' | 'cyan' | 'orange';

// Provisional brand-ish palette — swap for official values when supplied.
export const FRAME_COLORS: Record<FrameColor, { label: string; hex: string }> = {
  blue: { label: 'Royal blue', hex: '#2446e6' },
  green: { label: 'Green', hex: '#14a35a' },
  cyan: { label: 'Cyan', hex: '#0fb5d4' },
  orange: { label: 'Orange', hex: '#ff7417' },
};
export const FRAME_KEYS = Object.keys(FRAME_COLORS) as FrameColor[];
export const PIN_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5'];

export interface Card {
  id: string;
  image_url: string;
  frame_color: FrameColor;
  note: string;
  author_name: string;
  instagram: string;
  x: number;
  y: number;
  rotation: number;
  pin_color: string;
  created_at: string;
  hidden: boolean;
  like_count: number;
  comment_count: number;
}

export interface Comment {
  id: string;
  card_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export const CARD_W = 900; // composed card image size (px)
export const CARD_H = 1125;
export const WALL_CARD_W = 220; // size on the wall (world px)
export const WALL_CARD_H = 275;
export const NOTE_MAX = 140;
export const NAME_MAX = 40;
export const COOLDOWN_MS = 15_000;
export const COMMENT_COOLDOWN_MS = 5_000;
export const COMMENT_MAX = 200;
