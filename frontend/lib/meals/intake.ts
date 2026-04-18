export const MAX_TEXT_INPUT_LENGTH = 2_000;
export const MAX_IMAGE_ASSET_COUNT = 6;
export const MAX_AUDIO_ASSET_COUNT = 3;
export const MAX_TOTAL_FILE_ASSET_COUNT = 8;

export const mealInputMethodOptions = [
  {
    value: 'text',
    title: 'Text',
    description: 'Best when describing the meal is faster than taking a photo.',
    icon: 'text' as const,
  },
  {
    value: 'image',
    title: 'Photo upload',
    description: 'Add existing meal photos, labels, or screenshots.',
    icon: 'photo' as const,
  },
  {
    value: 'camera',
    title: 'Camera',
    description: 'Open the mobile camera directly when the browser supports it.',
    icon: 'camera' as const,
  },
  {
    value: 'audio',
    title: 'Audio',
    description: 'Upload or record a quick voice note about the meal.',
    icon: 'microphone' as const,
  },
] as const;

export type MealInputMethod = (typeof mealInputMethodOptions)[number]['value'];
