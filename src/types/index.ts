export type AccessibilityStatus = 'available' | 'unavailable' | 'unknown';

export interface AccessibilityFeature {
  id: string;
  label: string;
  status: AccessibilityStatus;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  features: AccessibilityFeature[];
  adminVerified?: boolean;
}
