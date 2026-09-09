import type { FeatureType, PlaceCategory } from '@/types';

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  hospital: 'Hospitals & Medical',
  health_center: 'Barangay Health Centers',
  government: 'Government & Civic Offices',
  school: 'Schools & DepEd Centers',
  mall: 'Shopping Malls & Markets',
  church: 'Churches & Parishes',
  park: 'Public Parks & Plazas',
};

export const CATEGORY_SHORT_LABELS: Record<PlaceCategory, string> = {
  hospital: 'Hospital',
  health_center: 'Health Center',
  government: 'Government',
  school: 'School',
  mall: 'Mall',
  church: 'Church',
  park: 'Park',
};

export const CATEGORY_ICONS: Record<PlaceCategory, string> = {
  hospital: '⊞',
  health_center: '♙',
  government: '▤',
  school: '▧',
  mall: '▦',
  church: '♜',
  park: '▥',
};

export const CATEGORY_DETAILS: Record<PlaceCategory, string> = {
  hospital: 'Trauma, ER & outpatient with accessible entrances',
  health_center: 'Maternal care, vaccine centers, step-free access',
  government: 'Barangay hall, PhilHealth, senior citizen desks',
  school: 'Step-free corridors and accessible gates',
  mall: 'Elevator lifts and wide bays',
  church: 'Nave wheelchair ramps',
  park: 'Paved walkways and accessible restrooms',
};

export const CATEGORY_ORDER: PlaceCategory[] = [
  'hospital',
  'health_center',
  'government',
  'school',
  'mall',
  'church',
  'park',
];

export const FEATURE_LABELS: Record<FeatureType, string> = {
  ramp: 'Ramps & Step-Free Access',
  restroom: 'Accessible Restroom / PWD CR',
  elevator: 'Elevator / Lift Access',
  parking: 'Accessible PWD Parking',
  entrance: 'Accessible Wide Entrance',
  other: 'Other Features',
};

export const FEATURE_ICONS: Record<FeatureType, string> = {
  ramp: '♿',
  restroom: '♟',
  elevator: '▣',
  parking: 'P',
  entrance: '▥',
  other: '◈',
};

export const FEATURE_DETAILS: Record<FeatureType, string> = {
  ramp: 'Gentle slope ramps at main entrance and corridors',
  restroom: 'Grab bars, minimum 90cm door clearance, wheelchair turn space',
  elevator: 'Braille buttons, audible floor indicators, multi-floor access',
  parking: 'Designated wide parking spaces near main entrance',
  entrance: 'Automatic or lever-handle doors, threshold ≤12mm',
  other: 'Additional verified accessibility provisions',
};

export const FEATURE_ORDER: FeatureType[] = [
  'ramp',
  'restroom',
  'elevator',
  'parking',
  'entrance',
];