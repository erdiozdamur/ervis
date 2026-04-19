export const MAX_TEXT_INPUT_LENGTH = 2_000;
export const MAX_IMAGE_ASSET_COUNT = 6;
export const MAX_AUDIO_ASSET_COUNT = 3;
export const MAX_TOTAL_FILE_ASSET_COUNT = 8;

export const mealInputMethodOptions = [
  {
    value: 'text',
    title: 'Yazı',
    description: 'Fotoğraf çekmek yerine kısa açıklama yazmak daha hızlıysa.',
    icon: 'text' as const,
  },
  {
    value: 'image',
    title: 'Fotoğraf yükle',
    description: 'Galerideki fotoğraf, etiket veya ekran görüntüsünü ekle.',
    icon: 'photo' as const,
  },
  {
    value: 'camera',
    title: 'Kamera',
    description: 'Tarayıcı destekliyorsa kamerayı doğrudan aç.',
    icon: 'camera' as const,
  },
  {
    value: 'audio',
    title: 'Ses',
    description: 'Öğün için ses dosyası yükle veya hızlı bir ses notu kaydet.',
    icon: 'microphone' as const,
  },
] as const;

export type MealInputMethod = (typeof mealInputMethodOptions)[number]['value'];
