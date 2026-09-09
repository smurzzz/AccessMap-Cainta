import { View } from 'react-native';

export type OSM_Pin = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  color?: string;
};

export type OSM_Point = {
  latitude: number;
  longitude: number;
};

export type OSM_Bounds = {
  southWest: OSM_Point;
  northEast: OSM_Point;
};

type Props = {
  pins?: OSM_Pin[];
  line?: OSM_Point[];
  focus?: OSM_Point;
  bounds?: OSM_Bounds;
  height?: number;
  onPinPress?: (id: string) => void;
};

export default function OSMMap({ height = 320 }: Props) {
  return <View style={{ height, backgroundColor: '#f6f4ef', borderRadius: 12 }} />;
}