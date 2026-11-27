export interface DeviceProfile {
  id: string;
  name: string;
  brand: 'Apple' | 'Samsung' | 'Google' | 'Xiaomi' | 'OnePlus' | 'Other';
  /** Physical width of the active display panel (short edge) in millimeters. */
  physicalWidthMm: number;
  /** Physical height of the active display panel (long edge) in millimeters. */
  physicalHeightMm: number;
  /** Nominal screen diagonal in inches. */
  diagonalInches: number;
  /** Native hardware PPI. */
  ppi: number;
  /** Standard CSS logical viewport [short, long] at default scale (for iOS matching). */
  logicalViewport?: [number, number];
  /** Standard devicePixelRatio for matching. */
  dpr?: number;
  /** Exact Android Client Hints model codes (navigator.userAgentData.model). */
  modelCodes?: string[];
}

/**
 * Curated database of modern iOS and Android smartphones with physical panel
 * dimensions derived from hardware pixel dimensions / hardware PPI * 25.4.
 *
 * Storing physical panel width in mm allows exact px/mm derivation even when
 * Android changes display resolution/DPI or iOS downsamples (e.g., iPhone mini).
 */
export const DEVICE_DATABASE: readonly DeviceProfile[] = [
  // --- Apple iPhone ---
  {
    id: 'iphone-16-17-pro-max',
    name: 'iPhone 16 Pro Max / 17 Pro Max',
    brand: 'Apple',
    physicalWidthMm: 72.89,
    physicalHeightMm: 158.36,
    diagonalInches: 6.86,
    ppi: 460,
    logicalViewport: [440, 956],
    dpr: 3,
  },
  {
    id: 'iphone-16-17-pro',
    name: 'iPhone 16 Pro / 17 / 17 Pro',
    brand: 'Apple',
    physicalWidthMm: 66.59,
    physicalHeightMm: 144.78,
    diagonalInches: 6.27,
    ppi: 460,
    logicalViewport: [402, 874],
    dpr: 3,
  },
  {
    id: 'iphone-14-15-16-plus-max',
    name: 'iPhone 14/15/16 Plus & 14/15 Pro Max',
    brand: 'Apple',
    physicalWidthMm: 71.23,
    physicalHeightMm: 154.39,
    diagonalInches: 6.69,
    ppi: 460,
    logicalViewport: [430, 932],
    dpr: 3,
  },
  {
    id: 'iphone-14-pro-15-16',
    name: 'iPhone 14 Pro / 15 / 15 Pro / 16',
    brand: 'Apple',
    physicalWidthMm: 65.10,
    physicalHeightMm: 141.13,
    diagonalInches: 6.12,
    ppi: 460,
    logicalViewport: [393, 852],
    dpr: 3,
  },
  {
    id: 'iphone-12-13-14-pro-max-plus',
    name: 'iPhone 12/13 Pro Max / 14 Plus',
    brand: 'Apple',
    physicalWidthMm: 71.21,
    physicalHeightMm: 154.06,
    diagonalInches: 6.68,
    ppi: 458,
    logicalViewport: [428, 926],
    dpr: 3,
  },
  {
    id: 'iphone-12-13-14',
    name: 'iPhone 12 / 12 Pro / 13 / 13 Pro / 14',
    brand: 'Apple',
    physicalWidthMm: 64.60,
    physicalHeightMm: 139.81,
    diagonalInches: 6.06,
    ppi: 460,
    logicalViewport: [390, 844],
    dpr: 3,
  },
  {
    id: 'iphone-12-13-mini',
    name: 'iPhone 12 mini / 13 mini',
    brand: 'Apple',
    physicalWidthMm: 57.63,
    physicalHeightMm: 124.87,
    diagonalInches: 5.42,
    ppi: 476,
    logicalViewport: [375, 812],
    dpr: 3,
  },
  {
    id: 'iphone-x-xs-11-pro',
    name: 'iPhone X / XS / 11 Pro',
    brand: 'Apple',
    physicalWidthMm: 62.39,
    physicalHeightMm: 135.10,
    diagonalInches: 5.85,
    ppi: 458,
    logicalViewport: [375, 812],
    dpr: 3,
  },
  {
    id: 'iphone-xs-max-11-pro-max',
    name: 'iPhone XS Max / 11 Pro Max',
    brand: 'Apple',
    physicalWidthMm: 68.88,
    physicalHeightMm: 149.06,
    diagonalInches: 6.46,
    ppi: 458,
    logicalViewport: [414, 896],
    dpr: 3,
  },
  {
    id: 'iphone-xr-11',
    name: 'iPhone XR / 11',
    brand: 'Apple',
    physicalWidthMm: 64.51,
    physicalHeightMm: 139.62,
    diagonalInches: 6.06,
    ppi: 326,
    logicalViewport: [414, 896],
    dpr: 2,
  },
  {
    id: 'iphone-se-2-3',
    name: 'iPhone SE (2nd/3rd gen) / 8 / 7',
    brand: 'Apple',
    physicalWidthMm: 58.44,
    physicalHeightMm: 103.94,
    diagonalInches: 4.7,
    ppi: 326,
    logicalViewport: [375, 667],
    dpr: 2,
  },

  // --- Samsung Galaxy ---
  {
    id: 'samsung-s25-ultra',
    name: 'Samsung Galaxy S25 Ultra',
    brand: 'Samsung',
    physicalWidthMm: 73.1,
    physicalHeightMm: 158.4,
    diagonalInches: 6.86,
    ppi: 498,
    modelCodes: ['SM-S938B', 'SM-S938U', 'SM-S938U1', 'SM-S938W', 'SM-S938N'],
  },
  {
    id: 'samsung-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra',
    brand: 'Samsung',
    physicalWidthMm: 72.3,
    physicalHeightMm: 156.4,
    diagonalInches: 6.79,
    ppi: 505,
    modelCodes: ['SM-S928B', 'SM-S928U', 'SM-S928U1', 'SM-S928W', 'SM-S928N'],
  },
  {
    id: 'samsung-s24-s25',
    name: 'Samsung Galaxy S24 / S25',
    brand: 'Samsung',
    physicalWidthMm: 66.0,
    physicalHeightMm: 142.8,
    diagonalInches: 6.2,
    ppi: 416,
    modelCodes: ['SM-S921B', 'SM-S921U', 'SM-S921U1', 'SM-S931B', 'SM-S931U'],
  },
  {
    id: 'samsung-s24-s25-plus',
    name: 'Samsung Galaxy S24+ / S25+',
    brand: 'Samsung',
    physicalWidthMm: 71.1,
    physicalHeightMm: 154.0,
    diagonalInches: 6.67,
    ppi: 513,
    modelCodes: ['SM-S926B', 'SM-S926U', 'SM-S936B', 'SM-S936U'],
  },
  {
    id: 'samsung-s23-ultra',
    name: 'Samsung Galaxy S23 Ultra',
    brand: 'Samsung',
    physicalWidthMm: 72.5,
    physicalHeightMm: 156.8,
    diagonalInches: 6.8,
    ppi: 500,
    modelCodes: ['SM-S918B', 'SM-S918U', 'SM-S918U1'],
  },
  {
    id: 'samsung-a55',
    name: 'Samsung Galaxy A55 5G',
    brand: 'Samsung',
    physicalWidthMm: 70.5,
    physicalHeightMm: 152.7,
    diagonalInches: 6.6,
    ppi: 390,
    modelCodes: ['SM-A556B', 'SM-A556E', 'SM-A556U'],
  },

  // --- Google Pixel ---
  {
    id: 'pixel-9-pro-xl',
    name: 'Google Pixel 9 Pro XL',
    brand: 'Google',
    physicalWidthMm: 70.4,
    physicalHeightMm: 156.7,
    diagonalInches: 6.75,
    ppi: 486,
    modelCodes: ['Pixel 9 Pro XL'],
  },
  {
    id: 'pixel-9-pro',
    name: 'Google Pixel 9 Pro',
    brand: 'Google',
    physicalWidthMm: 65.8,
    physicalHeightMm: 146.5,
    diagonalInches: 6.3,
    ppi: 495,
    modelCodes: ['Pixel 9 Pro'],
  },
  {
    id: 'pixel-9',
    name: 'Google Pixel 9',
    brand: 'Google',
    physicalWidthMm: 65.6,
    physicalHeightMm: 146.8,
    diagonalInches: 6.3,
    ppi: 422,
    modelCodes: ['Pixel 9'],
  },
  {
    id: 'pixel-8-pro',
    name: 'Google Pixel 8 Pro',
    brand: 'Google',
    physicalWidthMm: 69.9,
    physicalHeightMm: 155.3,
    diagonalInches: 6.7,
    ppi: 489,
    modelCodes: ['Pixel 8 Pro'],
  },
  {
    id: 'pixel-8',
    name: 'Google Pixel 8',
    brand: 'Google',
    physicalWidthMm: 64.9,
    physicalHeightMm: 144.2,
    diagonalInches: 6.2,
    ppi: 428,
    modelCodes: ['Pixel 8'],
  },
  {
    id: 'pixel-7',
    name: 'Google Pixel 7',
    brand: 'Google',
    physicalWidthMm: 65.8,
    physicalHeightMm: 146.2,
    diagonalInches: 6.3,
    ppi: 416,
    modelCodes: ['Pixel 7'],
  },

  // --- Xiaomi / OnePlus ---
  {
    id: 'xiaomi-14',
    name: 'Xiaomi 14',
    brand: 'Xiaomi',
    physicalWidthMm: 66.2,
    physicalHeightMm: 147.2,
    diagonalInches: 6.36,
    ppi: 460,
    modelCodes: ['23127PN0CG', '23127PN0CC'],
  },
  {
    id: 'xiaomi-14-ultra',
    name: 'Xiaomi 14 Ultra',
    brand: 'Xiaomi',
    physicalWidthMm: 70.1,
    physicalHeightMm: 155.8,
    diagonalInches: 6.73,
    ppi: 522,
    modelCodes: ['24030PN60G', '24030PN60C'],
  },
  {
    id: 'oneplus-12',
    name: 'OnePlus 12',
    brand: 'OnePlus',
    physicalWidthMm: 71.1,
    physicalHeightMm: 156.9,
    diagonalInches: 6.82,
    ppi: 510,
    modelCodes: ['CPH2581', 'CPH2583', 'PJD110'],
  },
  {
    id: 'oneplus-13',
    name: 'OnePlus 13',
    brand: 'OnePlus',
    physicalWidthMm: 71.2,
    physicalHeightMm: 157.0,
    diagonalInches: 6.82,
    ppi: 510,
    modelCodes: ['CPH2653', 'CPH2655', 'PJZ110'],
  },
];

export interface CalibrationReference {
  id: string;
  labelEn: string;
  labelRu: string;
  widthMm: number;
  heightMm?: number;
  shape: 'card' | 'circle' | 'bar';
}

export const CALIBRATION_REFERENCES: readonly CalibrationReference[] = [
  {
    id: 'iso-card',
    labelEn: 'Bank / Credit Card (ISO 7810)',
    labelRu: 'Банковская карта (ISO 7810)',
    widthMm: 85.6,
    heightMm: 53.98,
    shape: 'card',
  },
  {
    id: 'euro-1',
    labelEn: '1 Euro Coin (23.25 mm)',
    labelRu: 'Монета 1 Евро (23.25 мм)',
    widthMm: 23.25,
    shape: 'circle',
  },
  {
    id: 'usd-quarter',
    labelEn: 'US Quarter (24.26 mm)',
    labelRu: 'Монета 25 центов США (24.26 мм)',
    widthMm: 24.26,
    shape: 'circle',
  },
  {
    id: 'rub-10',
    labelEn: '10 RUB Coin (22.00 mm)',
    labelRu: 'Монета 10 рублей (22.00 мм)',
    widthMm: 22.0,
    shape: 'circle',
  },
  {
    id: 'custom-50',
    labelEn: 'Physical Ruler Segment (50 mm)',
    labelRu: 'Отрезок на линейке (50 мм)',
    widthMm: 50.0,
    shape: 'bar',
  },
];
