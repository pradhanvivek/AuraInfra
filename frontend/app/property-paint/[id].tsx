import { useLocalSearchParams } from 'expo-router';
import PaintEstimationScreen from '../../screens/property/PaintEstimationScreen';

export default function PropertyPaintRoute() {
  const { id } = useLocalSearchParams();
  return <PaintEstimationScreen propertyId={id as string} />;
}
