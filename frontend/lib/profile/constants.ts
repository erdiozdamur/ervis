import type { ProfileActivityLevel, ProfileGoalType, ProfileSex } from '@prisma/client';

export const PROFILE_TIME_ZONE = 'Europe/Istanbul';
export const PROFILE_CALCULATOR_VERSION = 'mifflin-v2';

export const sexOptions: Array<{ value: ProfileSex; label: string; description: string }> = [
  { value: 'FEMALE', label: 'Kadın', description: 'Sadece tahmini enerji hesabında kullanılır.' },
  { value: 'MALE', label: 'Erkek', description: 'Sadece tahmini enerji hesabında kullanılır.' },
];

export const goalTypeOptions: Array<{ value: ProfileGoalType; label: string; description: string }> = [
  { value: 'LOSE_FAT', label: 'Yağ kaybı', description: 'Orta seviyede kalori açığı ve dengeli protein hedefi.' },
  { value: 'MAINTAIN', label: 'Koru', description: 'Kilonu korumaya yönelik dengeli başlangıç hedefi.' },
  { value: 'GAIN_MUSCLE', label: 'Kas kazanımı', description: 'Orta seviyede kalori fazlası ve destekleyici makrolar.' },
];

export const activityLevelOptions: Array<{ value: ProfileActivityLevel; label: string; description: string }> = [
  { value: 'SEDENTARY', label: 'Masa başı', description: 'Günlerin çoğunda planlı hareket az.' },
  { value: 'LIGHT', label: 'Hafif aktif', description: 'Hafta boyunca yürüyüş ve hafif hareket var.' },
  { value: 'MODERATE', label: 'Orta aktif', description: 'Çoğu hafta düzenli hareket veya antrenman var.' },
  { value: 'ACTIVE', label: 'Çok aktif', description: 'Sık hareket, antrenman veya fiziksel yoğun günler.' },
  { value: 'VERY_ACTIVE', label: 'Yüksek aktif', description: 'Yoğun antrenman veya çok hareketli günlük düzen.' },
];

export const trainingFrequencyOptions = [
  { value: 0, label: '0', description: 'Çoğu hafta antrenman yok.' },
  { value: 2, label: '1-2', description: 'Hafif antrenman düzeni.' },
  { value: 4, label: '3-4', description: 'Düzenli antrenman temposu.' },
  { value: 6, label: '5+', description: 'Her hafta sık antrenman.' },
] as const;
