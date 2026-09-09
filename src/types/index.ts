export type PlaceCategory =
  | 'hospital'
  | 'health_center'
  | 'government'
  | 'school'
  | 'mall'
  | 'church'
  | 'park';

export type FeatureType =
  | 'ramp'
  | 'restroom'
  | 'elevator'
  | 'parking'
  | 'entrance'
  | 'other';

export type AccessibilityStatus = 'available' | 'not_available' | 'unavailable';

export interface AccessibilityFeature {
  id: string;
  place_id: string;
  feature_type: FeatureType;
  status: AccessibilityStatus;
  notes: string | null;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  operating_hours: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  accessibility_features?: AccessibilityFeature[];
}