import {
  AccentColor,
  CuratedAccentColor,
  SurfaceConfig,
  SurfacePresetId,
  TextColorConfig,
  TextColorPresetId,
} from '../types';

export interface ThemeConfig {
  name: string;
  id: AccentColor;
  primaryBg: string;
  primaryHover: string;
  badgeBg: string;
  badgeText: string;
  borderFocus: string;
  glow: string;
  textAccent: string;
  hex: string;
  buttonTextHex: string;
}

export const DARK_PALETTE = {
  // 1. Root & Canvas Backgrounds (Pure Flat Black)
  canvas: '#000000',
  bgCanvas: '#000000',
  secondary: '#000000',
  bgSecondary: '#000000',
  // 2. Multi-Column & Panel Architecture (Pure Flat Black)
  sidebar: '#000000',
  bgSidebar: '#000000',
  column: '#000000',
  bgColumn: '#000000',
  columnActive: '#000000',
  bgColumnActive: '#000000',
  columnHeader: '#000000',
  bgColumnHeader: '#000000',
  surface: '#000000',
  card: '#000000',
  bgCard: '#000000',
  cardHover: '#000000',
  bgCardHover: '#000000',
  elevated: '#000000',
  bgElevated: '#000000',
  // 3. Dividers, Borders & Depth
  borderSubtle: '#1E222B',
  borderColumn: '#1E222B',
  borderHeader: '#20242E',
  borderCard: '#232732',
  border: '#232732',
  shadowElevated: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
  scrollbarTrack: '#000000',
  scrollbarThumb: '#262A35',
  scrollbarThumbHover: '#373C4B',
} as const;

export const CURATED_20_ACCENT_KEYS: CuratedAccentColor[] = [
  'aegis_gold',
  'cyber_cyan',
  'electric_violet',
  'emerald_core',
  'crimson_protocol',
  'neon_amber',
  'cobalt_pulse',
  'hot_magenta',
  'toxic_lime',
  'deep_indigo',
  'burnt_orange',
  'teal_matrix',
  'rose_quartz',
  'skyline_blue',
  'spectral_purple',
  'sunburst_yellow',
  'mint_glaze',
  'steel_platinum',
  'blood_coral',
  'ultramarine',
];

export const ACCENT_THEMES: Record<AccentColor, ThemeConfig> = {
  // 1. Aegis Gold: #E5A93C
  aegis_gold: {
    name: 'Aegis Gold',
    id: 'aegis_gold',
    primaryBg: 'bg-[#E5A93C] hover:bg-[#eab85b] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#E5A93C]/20',
    badgeBg: 'bg-[#E5A93C]/12 border-[#E5A93C]/35',
    badgeText: 'text-[#E5A93C]',
    borderFocus: 'focus:border-[#E5A93C] focus:ring-[#E5A93C]/30',
    glow: 'rgba(229, 169, 60, 0.28)',
    textAccent: 'text-[#E5A93C]',
    hex: '#E5A93C',
    buttonTextHex: '#090A0F',
  },
  // 2. Cyber Cyan: #00E5FF
  cyber_cyan: {
    name: 'Cyber Cyan',
    id: 'cyber_cyan',
    primaryBg: 'bg-[#00E5FF] hover:bg-[#33ecff] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#00E5FF]/20',
    badgeBg: 'bg-[#00E5FF]/12 border-[#00E5FF]/35',
    badgeText: 'text-[#00E5FF]',
    borderFocus: 'focus:border-[#00E5FF] focus:ring-[#00E5FF]/30',
    glow: 'rgba(0, 229, 255, 0.28)',
    textAccent: 'text-[#00E5FF]',
    hex: '#00E5FF',
    buttonTextHex: '#090A0F',
  },
  // 3. Electric Violet: #8A2BE2
  electric_violet: {
    name: 'Electric Violet',
    id: 'electric_violet',
    primaryBg: 'bg-[#8A2BE2] hover:bg-[#9b47e8] text-white font-semibold',
    primaryHover: 'hover:bg-[#8A2BE2]/20',
    badgeBg: 'bg-[#8A2BE2]/15 border-[#8A2BE2]/40',
    badgeText: 'text-[#b374f5]',
    borderFocus: 'focus:border-[#8A2BE2] focus:ring-[#8A2BE2]/30',
    glow: 'rgba(138, 43, 226, 0.30)',
    textAccent: 'text-[#b374f5]',
    hex: '#8A2BE2',
    buttonTextHex: '#FFFFFF',
  },
  // 4. Emerald Core: #10B981
  emerald_core: {
    name: 'Emerald Core',
    id: 'emerald_core',
    primaryBg: 'bg-[#10B981] hover:bg-[#34d399] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#10B981]/20',
    badgeBg: 'bg-[#10B981]/12 border-[#10B981]/35',
    badgeText: 'text-[#10B981]',
    borderFocus: 'focus:border-[#10B981] focus:ring-[#10B981]/30',
    glow: 'rgba(16, 185, 129, 0.28)',
    textAccent: 'text-[#10B981]',
    hex: '#10B981',
    buttonTextHex: '#090A0F',
  },
  // 5. Crimson Protocol: #EF4444
  crimson_protocol: {
    name: 'Crimson Protocol',
    id: 'crimson_protocol',
    primaryBg: 'bg-[#EF4444] hover:bg-[#f87171] text-white font-semibold',
    primaryHover: 'hover:bg-[#EF4444]/20',
    badgeBg: 'bg-[#EF4444]/12 border-[#EF4444]/35',
    badgeText: 'text-[#f87171]',
    borderFocus: 'focus:border-[#EF4444] focus:ring-[#EF4444]/30',
    glow: 'rgba(239, 68, 68, 0.28)',
    textAccent: 'text-[#f87171]',
    hex: '#EF4444',
    buttonTextHex: '#FFFFFF',
  },
  // 6. Neon Amber: #F59E0B
  neon_amber: {
    name: 'Neon Amber',
    id: 'neon_amber',
    primaryBg: 'bg-[#F59E0B] hover:bg-[#fbbf24] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#F59E0B]/20',
    badgeBg: 'bg-[#F59E0B]/12 border-[#F59E0B]/35',
    badgeText: 'text-[#F59E0B]',
    borderFocus: 'focus:border-[#F59E0B] focus:ring-[#F59E0B]/30',
    glow: 'rgba(245, 158, 11, 0.28)',
    textAccent: 'text-[#F59E0B]',
    hex: '#F59E0B',
    buttonTextHex: '#090A0F',
  },
  // 7. Cobalt Pulse: #2563EB
  cobalt_pulse: {
    name: 'Cobalt Pulse',
    id: 'cobalt_pulse',
    primaryBg: 'bg-[#2563EB] hover:bg-[#3b82f6] text-white font-semibold',
    primaryHover: 'hover:bg-[#2563EB]/20',
    badgeBg: 'bg-[#2563EB]/15 border-[#2563EB]/40',
    badgeText: 'text-[#60a5fa]',
    borderFocus: 'focus:border-[#2563EB] focus:ring-[#2563EB]/30',
    glow: 'rgba(37, 99, 235, 0.30)',
    textAccent: 'text-[#60a5fa]',
    hex: '#2563EB',
    buttonTextHex: '#FFFFFF',
  },
  // 8. Hot Magenta: #EC4899
  hot_magenta: {
    name: 'Hot Magenta',
    id: 'hot_magenta',
    primaryBg: 'bg-[#EC4899] hover:bg-[#f472b6] text-white font-semibold',
    primaryHover: 'hover:bg-[#EC4899]/20',
    badgeBg: 'bg-[#EC4899]/12 border-[#EC4899]/35',
    badgeText: 'text-[#f472b6]',
    borderFocus: 'focus:border-[#EC4899] focus:ring-[#EC4899]/30',
    glow: 'rgba(236, 72, 153, 0.28)',
    textAccent: 'text-[#f472b6]',
    hex: '#EC4899',
    buttonTextHex: '#FFFFFF',
  },
  // 9. Toxic Lime: #84CC16
  toxic_lime: {
    name: 'Toxic Lime',
    id: 'toxic_lime',
    primaryBg: 'bg-[#84CC16] hover:bg-[#a3e635] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#84CC16]/20',
    badgeBg: 'bg-[#84CC16]/12 border-[#84CC16]/35',
    badgeText: 'text-[#a3e635]',
    borderFocus: 'focus:border-[#84CC16] focus:ring-[#84CC16]/30',
    glow: 'rgba(132, 204, 22, 0.28)',
    textAccent: 'text-[#a3e635]',
    hex: '#84CC16',
    buttonTextHex: '#090A0F',
  },
  // 10. Deep Indigo: #6366F1
  deep_indigo: {
    name: 'Deep Indigo',
    id: 'deep_indigo',
    primaryBg: 'bg-[#6366F1] hover:bg-[#818cf8] text-white font-semibold',
    primaryHover: 'hover:bg-[#6366F1]/20',
    badgeBg: 'bg-[#6366F1]/15 border-[#6366F1]/40',
    badgeText: 'text-[#818cf8]',
    borderFocus: 'focus:border-[#6366F1] focus:ring-[#6366F1]/30',
    glow: 'rgba(99, 102, 241, 0.28)',
    textAccent: 'text-[#818cf8]',
    hex: '#6366F1',
    buttonTextHex: '#FFFFFF',
  },
  // 11. Burnt Orange: #F97316
  burnt_orange: {
    name: 'Burnt Orange',
    id: 'burnt_orange',
    primaryBg: 'bg-[#F97316] hover:bg-[#fb923c] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#F97316]/20',
    badgeBg: 'bg-[#F97316]/12 border-[#F97316]/35',
    badgeText: 'text-[#fb923c]',
    borderFocus: 'focus:border-[#F97316] focus:ring-[#F97316]/30',
    glow: 'rgba(249, 115, 22, 0.28)',
    textAccent: 'text-[#fb923c]',
    hex: '#F97316',
    buttonTextHex: '#090A0F',
  },
  // 12. Teal Matrix: #14B8A6
  teal_matrix: {
    name: 'Teal Matrix',
    id: 'teal_matrix',
    primaryBg: 'bg-[#14B8A6] hover:bg-[#2dd4bf] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#14B8A6]/20',
    badgeBg: 'bg-[#14B8A6]/12 border-[#14B8A6]/35',
    badgeText: 'text-[#2dd4bf]',
    borderFocus: 'focus:border-[#14B8A6] focus:ring-[#14B8A6]/30',
    glow: 'rgba(20, 184, 166, 0.28)',
    textAccent: 'text-[#2dd4bf]',
    hex: '#14B8A6',
    buttonTextHex: '#090A0F',
  },
  // 13. Rose Quartz: #F43F5E
  rose_quartz: {
    name: 'Rose Quartz',
    id: 'rose_quartz',
    primaryBg: 'bg-[#F43F5E] hover:bg-[#fb7185] text-white font-semibold',
    primaryHover: 'hover:bg-[#F43F5E]/20',
    badgeBg: 'bg-[#F43F5E]/12 border-[#F43F5E]/35',
    badgeText: 'text-[#fb7185]',
    borderFocus: 'focus:border-[#F43F5E] focus:ring-[#F43F5E]/30',
    glow: 'rgba(244, 63, 94, 0.28)',
    textAccent: 'text-[#fb7185]',
    hex: '#F43F5E',
    buttonTextHex: '#FFFFFF',
  },
  // 14. Skyline Blue: #0EA5E9
  skyline_blue: {
    name: 'Skyline Blue',
    id: 'skyline_blue',
    primaryBg: 'bg-[#0EA5E9] hover:bg-[#38bdf8] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#0EA5E9]/20',
    badgeBg: 'bg-[#0EA5E9]/12 border-[#0EA5E9]/35',
    badgeText: 'text-[#38bdf8]',
    borderFocus: 'focus:border-[#0EA5E9] focus:ring-[#0EA5E9]/30',
    glow: 'rgba(14, 165, 233, 0.28)',
    textAccent: 'text-[#38bdf8]',
    hex: '#0EA5E9',
    buttonTextHex: '#090A0F',
  },
  // 15. Spectral Purple: #A855F7
  spectral_purple: {
    name: 'Spectral Purple',
    id: 'spectral_purple',
    primaryBg: 'bg-[#A855F7] hover:bg-[#c084fc] text-white font-semibold',
    primaryHover: 'hover:bg-[#A855F7]/20',
    badgeBg: 'bg-[#A855F7]/15 border-[#A855F7]/40',
    badgeText: 'text-[#c084fc]',
    borderFocus: 'focus:border-[#A855F7] focus:ring-[#A855F7]/30',
    glow: 'rgba(168, 85, 247, 0.28)',
    textAccent: 'text-[#c084fc]',
    hex: '#A855F7',
    buttonTextHex: '#FFFFFF',
  },
  // 16. Sunburst Yellow: #EAB308
  sunburst_yellow: {
    name: 'Sunburst Yellow',
    id: 'sunburst_yellow',
    primaryBg: 'bg-[#EAB308] hover:bg-[#facc15] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#EAB308]/20',
    badgeBg: 'bg-[#EAB308]/12 border-[#EAB308]/35',
    badgeText: 'text-[#facc15]',
    borderFocus: 'focus:border-[#EAB308] focus:ring-[#EAB308]/30',
    glow: 'rgba(234, 179, 8, 0.28)',
    textAccent: 'text-[#facc15]',
    hex: '#EAB308',
    buttonTextHex: '#090A0F',
  },
  // 17. Mint Glaze: #2DD4BF
  mint_glaze: {
    name: 'Mint Glaze',
    id: 'mint_glaze',
    primaryBg: 'bg-[#2DD4BF] hover:bg-[#5eead4] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#2DD4BF]/20',
    badgeBg: 'bg-[#2DD4BF]/12 border-[#2DD4BF]/35',
    badgeText: 'text-[#2DD4BF]',
    borderFocus: 'focus:border-[#2DD4BF] focus:ring-[#2DD4BF]/30',
    glow: 'rgba(45, 212, 191, 0.28)',
    textAccent: 'text-[#2DD4BF]',
    hex: '#2DD4BF',
    buttonTextHex: '#090A0F',
  },
  // 18. Steel Platinum: #94A3B8
  steel_platinum: {
    name: 'Steel Platinum',
    id: 'steel_platinum',
    primaryBg: 'bg-[#94A3B8] hover:bg-[#cbd5e1] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#94A3B8]/20',
    badgeBg: 'bg-[#94A3B8]/15 border-[#94A3B8]/40',
    badgeText: 'text-[#cbd5e1]',
    borderFocus: 'focus:border-[#94A3B8] focus:ring-[#94A3B8]/30',
    glow: 'rgba(148, 163, 184, 0.26)',
    textAccent: 'text-[#cbd5e1]',
    hex: '#94A3B8',
    buttonTextHex: '#090A0F',
  },
  // 19. Blood Coral: #FB7185
  blood_coral: {
    name: 'Blood Coral',
    id: 'blood_coral',
    primaryBg: 'bg-[#FB7185] hover:bg-[#fda4af] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#FB7185]/20',
    badgeBg: 'bg-[#FB7185]/12 border-[#FB7185]/35',
    badgeText: 'text-[#FB7185]',
    borderFocus: 'focus:border-[#FB7185] focus:ring-[#FB7185]/30',
    glow: 'rgba(251, 113, 133, 0.28)',
    textAccent: 'text-[#FB7185]',
    hex: '#FB7185',
    buttonTextHex: '#090A0F',
  },
  // 20. Ultramarine: #4F46E5
  ultramarine: {
    name: 'Ultramarine',
    id: 'ultramarine',
    primaryBg: 'bg-[#4F46E5] hover:bg-[#6366f1] text-white font-semibold',
    primaryHover: 'hover:bg-[#4F46E5]/20',
    badgeBg: 'bg-[#4F46E5]/15 border-[#4F46E5]/40',
    badgeText: 'text-[#818cf8]',
    borderFocus: 'focus:border-[#4F46E5] focus:ring-[#4F46E5]/30',
    glow: 'rgba(79, 70, 229, 0.30)',
    textAccent: 'text-[#818cf8]',
    hex: '#4F46E5',
    buttonTextHex: '#FFFFFF',
  },

  // Backward-compatible legacy aliases mapped to the curated palette
  emerald: {
    name: 'Emerald Core',
    id: 'emerald',
    primaryBg: 'bg-[#10B981] hover:bg-[#34d399] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#10B981]/20',
    badgeBg: 'bg-[#10B981]/12 border-[#10B981]/35',
    badgeText: 'text-[#10B981]',
    borderFocus: 'focus:border-[#10B981] focus:ring-[#10B981]/30',
    glow: 'rgba(16, 185, 129, 0.28)',
    textAccent: 'text-[#10B981]',
    hex: '#10B981',
    buttonTextHex: '#090A0F',
  },
  cyan: {
    name: 'Cyber Cyan',
    id: 'cyan',
    primaryBg: 'bg-[#00E5FF] hover:bg-[#33ecff] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#00E5FF]/20',
    badgeBg: 'bg-[#00E5FF]/12 border-[#00E5FF]/35',
    badgeText: 'text-[#00E5FF]',
    borderFocus: 'focus:border-[#00E5FF] focus:ring-[#00E5FF]/30',
    glow: 'rgba(0, 229, 255, 0.28)',
    textAccent: 'text-[#00E5FF]',
    hex: '#00E5FF',
    buttonTextHex: '#090A0F',
  },
  violet: {
    name: 'Electric Violet',
    id: 'violet',
    primaryBg: 'bg-[#8A2BE2] hover:bg-[#9b47e8] text-white font-semibold',
    primaryHover: 'hover:bg-[#8A2BE2]/20',
    badgeBg: 'bg-[#8A2BE2]/15 border-[#8A2BE2]/40',
    badgeText: 'text-[#b374f5]',
    borderFocus: 'focus:border-[#8A2BE2] focus:ring-[#8A2BE2]/30',
    glow: 'rgba(138, 43, 226, 0.30)',
    textAccent: 'text-[#b374f5]',
    hex: '#8A2BE2',
    buttonTextHex: '#FFFFFF',
  },
  amber: {
    name: 'Neon Amber',
    id: 'amber',
    primaryBg: 'bg-[#F59E0B] hover:bg-[#fbbf24] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#F59E0B]/20',
    badgeBg: 'bg-[#F59E0B]/12 border-[#F59E0B]/35',
    badgeText: 'text-[#F59E0B]',
    borderFocus: 'focus:border-[#F59E0B] focus:ring-[#F59E0B]/30',
    glow: 'rgba(245, 158, 11, 0.28)',
    textAccent: 'text-[#F59E0B]',
    hex: '#F59E0B',
    buttonTextHex: '#090A0F',
  },
  rose: {
    name: 'Rose Quartz',
    id: 'rose',
    primaryBg: 'bg-[#F43F5E] hover:bg-[#fb7185] text-white font-semibold',
    primaryHover: 'hover:bg-[#F43F5E]/20',
    badgeBg: 'bg-[#F43F5E]/12 border-[#F43F5E]/35',
    badgeText: 'text-[#fb7185]',
    borderFocus: 'focus:border-[#F43F5E] focus:ring-[#F43F5E]/30',
    glow: 'rgba(244, 63, 94, 0.28)',
    textAccent: 'text-[#fb7185]',
    hex: '#F43F5E',
    buttonTextHex: '#FFFFFF',
  },
  indigo: {
    name: 'Deep Indigo',
    id: 'indigo',
    primaryBg: 'bg-[#6366F1] hover:bg-[#818cf8] text-white font-semibold',
    primaryHover: 'hover:bg-[#6366F1]/20',
    badgeBg: 'bg-[#6366F1]/15 border-[#6366F1]/40',
    badgeText: 'text-[#818cf8]',
    borderFocus: 'focus:border-[#6366F1] focus:ring-[#6366F1]/30',
    glow: 'rgba(99, 102, 241, 0.28)',
    textAccent: 'text-[#818cf8]',
    hex: '#6366F1',
    buttonTextHex: '#FFFFFF',
  },
  sky: {
    name: 'Skyline Blue',
    id: 'sky',
    primaryBg: 'bg-[#0EA5E9] hover:bg-[#38bdf8] text-[#090A0F] font-semibold',
    primaryHover: 'hover:bg-[#0EA5E9]/20',
    badgeBg: 'bg-[#0EA5E9]/12 border-[#0EA5E9]/35',
    badgeText: 'text-[#38bdf8]',
    borderFocus: 'focus:border-[#0EA5E9] focus:ring-[#0EA5E9]/30',
    glow: 'rgba(14, 165, 233, 0.28)',
    textAccent: 'text-[#38bdf8]',
    hex: '#0EA5E9',
    buttonTextHex: '#090A0F',
  },
};

export const CURATED_20_ACCENTS: ThemeConfig[] = CURATED_20_ACCENT_KEYS.map(
  (key) => ACCENT_THEMES[key]
);

export function isValidAccentColor(val: unknown): val is AccentColor {
  return typeof val === 'string' && val in ACCENT_THEMES;
}

export function buildCustomAccentTheme(rawHex: string, baseColor?: AccentColor): ThemeConfig {
  const hex = normalizeHexColor(rawHex, ACCENT_THEMES.aegis_gold.hex);
  const matchingCurated = CURATED_20_ACCENTS.find((c) => c.hex.toUpperCase() === hex);
  if (matchingCurated) {
    return matchingCurated;
  }
  const base =
    baseColor && isValidAccentColor(baseColor)
      ? ACCENT_THEMES[baseColor]
      : ACCENT_THEMES.aegis_gold;
  const { r, g, b } = hexToRgb(hex);
  const lum = getRelativeLuminance(hex);
  const buttonTextHex: '#090A0F' | '#FFFFFF' = lum > 0.35 ? '#090A0F' : '#FFFFFF';
  return {
    ...base,
    name: `Custom (${hex})`,
    hex,
    glow: `rgba(${r}, ${g}, ${b}, 0.28)`,
    buttonTextHex,
  };
}

export function resolveAccentTheme(
  accentColor?: AccentColor | string,
  customAccentHex?: string
): ThemeConfig {
  if (typeof customAccentHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(customAccentHex.trim())) {
    return buildCustomAccentTheme(
      customAccentHex.trim(),
      isValidAccentColor(accentColor) ? accentColor : 'aegis_gold'
    );
  }
  if (typeof accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColor.trim())) {
    return buildCustomAccentTheme(accentColor.trim(), 'aegis_gold');
  }
  if (accentColor && isValidAccentColor(accentColor)) {
    return ACCENT_THEMES[accentColor];
  }
  return ACCENT_THEMES.aegis_gold;
}

/**
 * Normalizes a 3-digit or 6-digit hex color string into uppercase `#RRGGBB`.
 */
export function normalizeHexColor(rawHex: unknown, fallback: string = '#F8FAFC'): string {
  if (typeof rawHex !== 'string') return fallback;
  const clean = rawHex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `#${(r + g + b).toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`;
  }
  return fallback;
}

/**
 * Parses a hex color into `{ r, g, b }` integers (0-255).
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex, '#F8FAFC').slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Blends two hex colors by `weightA` (0..1 for `hexA`).
 */
export function blendHexColors(hexA: string, hexB: string, weightA: number = 0.8): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.min(1, Math.max(0, weightA));
  const r = Math.round(a.r * w + b.r * (1 - w));
  const g = Math.round(a.g * w + b.g * (1 - w));
  const bl = Math.round(a.b * w + b.b * (1 - w));
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/**
 * Calculates WCAG 2.1 relative luminance (0.0 darkest to 1.0 brightest).
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (channel: number) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors (1.0 to 21.0, rounded to 2 decimals).
 */
export function getContrastRatio(foregroundHex: string, backgroundHex: string = DARK_PALETTE.surface): number {
  const lum1 = getRelativeLuminance(foregroundHex);
  const lum2 = getRelativeLuminance(backgroundHex);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = (brightest + 0.05) / (darkest + 0.05);
  return Math.round(ratio * 100) / 100;
}

export interface WcagContrastEvaluation {
  ratio: number;
  passesAA: boolean; // >= 4.5:1
  passesAAA: boolean; // >= 7.0:1
  passesLargeAA: boolean; // >= 3.0:1
  rating: 'AAA' | 'AA' | 'AA Large' | 'Low Contrast';
  level: 'AAA' | 'AA' | 'AA Large' | 'Fail';
  warning: string | null;
}

/**
 * Evaluates whether a foreground text color meets WCAG AA/AAA accessibility standards
 * against the active dark surface (`#12141A` by default).
 */
export function evaluateWcagContrast(
  foregroundHex: string,
  backgroundHex: string = DARK_PALETTE.surface
): WcagContrastEvaluation {
  const ratio = getContrastRatio(foregroundHex, backgroundHex);
  const passesAAA = ratio >= 7.0;
  const passesAA = ratio >= 4.5;
  const passesLargeAA = ratio >= 3.0;

  let rating: WcagContrastEvaluation['rating'] = 'Low Contrast';
  let level: WcagContrastEvaluation['level'] = 'Fail';
  if (passesAAA) {
    rating = 'AAA';
    level = 'AAA';
  } else if (passesAA) {
    rating = 'AA';
    level = 'AA';
  } else if (passesLargeAA) {
    rating = 'AA Large';
    level = 'AA Large';
  }

  const warning = !passesAA
    ? `Contrast ratio is ${ratio.toFixed(2)}:1 against dark surface (${backgroundHex}), which falls below the WCAG AA 4.5:1 legibility threshold.`
    : null;

  return {
    ratio,
    passesAA,
    passesAAA,
    passesLargeAA,
    rating,
    level,
    warning,
  };
}

export interface TextColorPresetOption {
  id: TextColorPresetId;
  name: string;
  label: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
}

export const TEXT_COLOR_PRESETS: TextColorPresetOption[] = [
  {
    id: 'crisp_white',
    name: 'Crisp White',
    label: 'Crisp White',
    description: 'Maximum luminance & contrast',
    primaryHex: '#F8FAFC',
    secondaryHex: '#94A3B8',
  },
  {
    id: 'soft_gray',
    name: 'Soft Gray',
    label: 'Soft Gray',
    description: 'Balanced eye-comfort slate',
    primaryHex: '#E2E8F0',
    secondaryHex: '#94A3B8',
  },
  {
    id: 'muted_silver',
    name: 'Muted Silver',
    label: 'Muted Silver',
    description: 'Low-glare nocturnal silver',
    primaryHex: '#CBD5E1',
    secondaryHex: '#8E9BAE',
  },
  {
    id: 'warm_off_white',
    name: 'Warm Off-White',
    label: 'Warm Off-White',
    description: 'Paper-warm editorial tone',
    primaryHex: '#F5F5F4',
    secondaryHex: '#A8A29E',
  },
  {
    id: 'accent_tint',
    name: 'Accent Tint',
    label: 'Accent Tint',
    description: 'Tinted with active theme color',
    primaryHex: '#F8FAFC',
    secondaryHex: '#CBD5E1',
  },
  {
    id: 'custom',
    name: 'Custom Hex',
    label: 'Custom Hex',
    description: 'User-defined hex override',
    primaryHex: '#F8FAFC',
    secondaryHex: '#94A3B8',
  },
];

export const DEFAULT_TEXT_COLOR_CONFIG: TextColorConfig = {
  preset: 'crisp_white',
  primaryHex: '#F8FAFC',
  secondaryHex: '#94A3B8',
};

/**
 * Resolves the active primary & secondary text hex values given a `TextColorConfig` and active `accentHex`.
 */
export function resolveTextColorConfig(
  config?: Partial<TextColorConfig> | null,
  accentHex: string = '#E5A93C'
): TextColorConfig {
  const preset: TextColorPresetId =
    config?.preset && TEXT_COLOR_PRESETS.some((p) => p.id === config.preset)
      ? config.preset
      : 'crisp_white';

  if (preset === 'accent_tint') {
    return {
      preset: 'accent_tint',
      primaryHex: blendHexColors('#F8FAFC', accentHex, 0.78),
      secondaryHex: blendHexColors('#94A3B8', accentHex, 0.72),
    };
  }

  if (preset === 'custom') {
    return {
      preset: 'custom',
      primaryHex: normalizeHexColor(config?.primaryHex, '#F8FAFC'),
      secondaryHex: normalizeHexColor(config?.secondaryHex, '#94A3B8'),
    };
  }

  const found = TEXT_COLOR_PRESETS.find((p) => p.id === preset) || TEXT_COLOR_PRESETS[0];
  return {
    preset: found.id,
    primaryHex: found.primaryHex,
    secondaryHex: found.secondaryHex,
  };
}

export interface SurfacePresetOption {
  id: SurfacePresetId;
  name: string;
  label: string;
  description: string;
  canvasHex: string;
  columnHex: string;
  cardHex: string;
}

export const SURFACE_PRESETS: SurfacePresetOption[] = [
  {
    id: 'flat_black',
    name: 'Pure Flat Black',
    label: 'Pure Flat Black (#000000)',
    description: 'Zero-glare OLED flat black across canvas, columns, and cards',
    canvasHex: '#000000',
    columnHex: '#000000',
    cardHex: '#000000',
  },
  {
    id: 'obsidian_slate',
    name: 'Obsidian Slate',
    label: 'Obsidian Slate',
    description: 'Subtle charcoal elevation layers',
    canvasHex: '#000000',
    columnHex: '#0A0B0E',
    cardHex: '#111318',
  },
  {
    id: 'midnight_carbon',
    name: 'Midnight Carbon',
    label: 'Midnight Carbon',
    description: 'Deep carbon surface contrast',
    canvasHex: '#050507',
    columnHex: '#0D0E12',
    cardHex: '#14161D',
  },
  {
    id: 'custom',
    name: 'Custom Surfaces',
    label: 'Custom Hex',
    description: 'User-defined canvas, column & card hex',
    canvasHex: '#000000',
    columnHex: '#000000',
    cardHex: '#000000',
  },
];

export interface BorderPresetOption {
  id: string;
  label: string;
  hex: string;
}

export const BORDER_PRESETS: BorderPresetOption[] = [
  { id: 'tactical_slate', label: 'Tactical Slate (#1E222B)', hex: '#1E222B' },
  { id: 'pitch_hairline', label: 'Pitch Hairline (#0F1117)', hex: '#0F1117' },
  { id: 'obsidian_line', label: 'Obsidian Line (#27272A)', hex: '#27272A' },
  { id: 'steel_wire', label: 'Steel Wire (#334155)', hex: '#334155' },
  { id: 'zinc_edge', label: 'Zinc Edge (#3F3F46)', hex: '#3F3F46' },
];

export const DEFAULT_SURFACE_CONFIG: SurfaceConfig = {
  preset: 'flat_black',
  canvasHex: '#000000',
  columnHex: '#000000',
  cardHex: '#000000',
  borderHex: '#1E222B',
};

/**
 * Resolves the active surface layer hex values (`canvasHex`, `columnHex`, `cardHex`, `borderHex`).
 * Defaults strictly to Pure Flat Black (`#000000`) and Tactical Slate border (`#1E222B`) unless explicitly customized.
 */
export function resolveSurfaceConfig(config?: Partial<SurfaceConfig> | null): SurfaceConfig {
  const preset: SurfacePresetId =
    config?.preset && SURFACE_PRESETS.some((p) => p.id === config.preset)
      ? config.preset
      : 'flat_black';

  const resolvedBorderHex = normalizeHexColor(config?.borderHex, DARK_PALETTE.borderSubtle);

  if (preset === 'custom') {
    return {
      preset: 'custom',
      canvasHex: normalizeHexColor(config?.canvasHex, '#000000'),
      columnHex: normalizeHexColor(config?.columnHex, '#000000'),
      cardHex: normalizeHexColor(config?.cardHex, '#000000'),
      borderHex: resolvedBorderHex,
    };
  }

  const found = SURFACE_PRESETS.find((p) => p.id === preset) || SURFACE_PRESETS[0];
  return {
    preset: found.id,
    canvasHex: found.canvasHex,
    columnHex: found.columnHex,
    cardHex: found.cardHex,
    borderHex: resolvedBorderHex,
  };
}

/**
 * Computes the complete map of global CSS custom properties (`--bg-surface`, `--bg-elevated`,
 * `--border-subtle`, `--text-primary`, `--text-muted`, `--accent-primary`, etc.)
 * from the unified Theme & Customization state.
 */
export function computeThemeCssVariables(
  settings?: {
    accentColor?: AccentColor | string;
    customAccentHex?: string;
    sidebarIconColor?: string;
    surfaceConfig?: Partial<SurfaceConfig> | null;
    textColorConfig?: Partial<TextColorConfig> | null;
    layout?: {
      fontScale?: 'sm' | 'md' | 'lg' | number | string;
      density?: 'compact' | 'comfortable' | 'spacious' | string;
      customPageMaxWidthPx?: number;
      customGridGapPx?: number;
    } | null;
  } | null,
  layoutOverride?: {
    fontScale?: 'sm' | 'md' | 'lg' | number | string;
    density?: 'compact' | 'comfortable' | 'spacious' | string;
    customPageMaxWidthPx?: number;
    customGridGapPx?: number;
    sidebarIconColor?: string;
  } | null
): Record<string, string> {
  const activeAccentTheme = resolveAccentTheme(settings?.accentColor, settings?.customAccentHex);
  const resolvedText = resolveTextColorConfig(settings?.textColorConfig, activeAccentTheme.hex);
  const resolvedSurface = resolveSurfaceConfig(settings?.surfaceConfig);
  const borderSubtleHex = resolvedSurface.borderHex || DARK_PALETTE.borderSubtle;
  const candidateIconColor = layoutOverride?.sidebarIconColor || settings?.sidebarIconColor;
  const iconColorHex =
    candidateIconColor && /^#[0-9A-Fa-f]{6}$/.test(candidateIconColor.trim())
      ? candidateIconColor.trim().toUpperCase()
      : '#00E5FF';

  const fontScaleKey =
    layoutOverride?.fontScale ?? settings?.layout?.fontScale ?? 'md';
  const densityKey =
    layoutOverride?.density || settings?.layout?.density || 'comfortable';

  const scaleVal =
    typeof fontScaleKey === 'number'
      ? Math.min(1.35, Math.max(0.85, fontScaleKey))
      : fontScaleKey === 'sm'
      ? 0.92
      : fontScaleKey === 'lg'
      ? 1.08
      : 1;
  const padVal =
    densityKey === 'compact' ? '0.85rem' : densityKey === 'spacious' ? '1.65rem' : '1.25rem';

  const customGapPx =
    layoutOverride?.customGridGapPx ?? settings?.layout?.customGridGapPx;
  const gapVal =
    typeof customGapPx === 'number' && customGapPx >= 6 && customGapPx <= 48
      ? `${Math.round(customGapPx)}px`
      : densityKey === 'compact'
      ? '0.75rem'
      : densityKey === 'spacious'
      ? '1.35rem'
      : '1rem';

  const customMaxW =
    layoutOverride?.customPageMaxWidthPx ?? settings?.layout?.customPageMaxWidthPx;
  const maxWidthVal =
    typeof customMaxW === 'number' && customMaxW >= 960 && customMaxW <= 3840
      ? `${Math.round(customMaxW)}px`
      : '1680px';

  return {
    '--bg-surface': resolvedSurface.columnHex,
    '--bg-elevated': resolvedSurface.cardHex,
    '--bg-canvas': resolvedSurface.canvasHex,
    '--bg-secondary': resolvedSurface.canvasHex,
    '--bg-sidebar': resolvedSurface.canvasHex,
    '--bg-column': resolvedSurface.columnHex,
    '--bg-column-active': resolvedSurface.columnHex,
    '--bg-column-header': resolvedSurface.columnHex,
    '--bg-card': resolvedSurface.cardHex,
    '--bg-card-hover': resolvedSurface.cardHex,
    '--bg-inner': resolvedSurface.cardHex,
    '--border-subtle': borderSubtleHex,
    '--border-column-header': borderSubtleHex,
    '--border-card': borderSubtleHex,
    '--shadow-elevated': DARK_PALETTE.shadowElevated,
    '--scrollbar-track': resolvedSurface.canvasHex,
    '--scrollbar-thumb': DARK_PALETTE.scrollbarThumb,
    '--scrollbar-thumb-hover': DARK_PALETTE.scrollbarThumbHover,
    '--text-primary': resolvedText.primaryHex,
    '--text-secondary': resolvedText.secondaryHex,
    '--text-muted': resolvedText.secondaryHex,
    '--accent-primary': activeAccentTheme.hex,
    '--accent-glow': activeAccentTheme.glow,
    '--icon-color': iconColorHex,
    '--app-font-scale': String(scaleVal),
    '--app-card-pad': padVal,
    '--app-grid-gap': gapVal,
    '--app-page-max-width': maxWidthVal,
  };
}

/**
 * Resets theme, surface, and text color configurations back to the Tactical Flat-Black Default:
 * - Surface: Pure Flat Black (`#000000`) & Tactical Slate Border (`#1E222B`)
 * - Text: Crisp White (`#F8FAFC` / `#94A3B8`)
 * - Accent: Aegis Tactical Gold (`#E5A93C`)
 */
export function resetToTacticalFlatBlackDefaults<T extends object = Record<string, unknown>>(
  currentSettings?: T
): T & {
  accentColor: AccentColor;
  customAccentHex?: undefined;
  sidebarIconColor: string;
  surfaceConfig: SurfaceConfig;
  textColorConfig: TextColorConfig;
} {
  return {
    ...(currentSettings || ({} as T)),
    accentColor: 'aegis_gold',
    customAccentHex: undefined,
    sidebarIconColor: '#00E5FF',
    surfaceConfig: { ...DEFAULT_SURFACE_CONFIG },
    textColorConfig: { ...DEFAULT_TEXT_COLOR_CONFIG },
  };
}



