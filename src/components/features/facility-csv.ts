import {
  CATEGORY_LABELS,
  FEATURE_LABELS,
  FEATURE_ORDER,
} from '@/constants/catalog';
import type { Place } from '@/types';

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Facility data export: one row per facility with every feature's availability. */
export function buildFacilityCsv(placesToExport: Place[]): string {
  const header = [
    'Facility',
    'Category',
    'Address',
    'Operating Hours',
    'Last Updated',
    ...FEATURE_ORDER.map((type) => FEATURE_LABELS[type]),
    'Available Features',
    'Missing Features',
  ];
  const rows = placesToExport.map((place) => {
    const features = place.accessibility_features ?? [];
    const available = FEATURE_ORDER.filter((type) =>
      features.some((feature) => feature.feature_type === type && feature.status === 'available'),
    );
    const missing = FEATURE_ORDER.filter(
      (type) => !features.some((feature) => feature.feature_type === type && feature.status === 'available'),
    );
    return [
      place.name,
      CATEGORY_LABELS[place.category],
      place.address ?? '',
      place.operating_hours ?? '',
      new Date(place.updated_at).toISOString().slice(0, 10),
      ...FEATURE_ORDER.map((type) => (available.includes(type) ? 'Available' : 'Missing')),
      available.map((type) => FEATURE_LABELS[type]).join('; '),
      missing.map((type) => FEATURE_LABELS[type]).join('; '),
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
