import { useLocalSearchParams } from 'expo-router';
import VastuScreen from '../../screens/property/VastuScreen';

export default function PropertyFengshuiRoute() {
  const { id } = useLocalSearchParams();
  return <VastuScreen propertyId={id as string} geomancyType="feng_shui" />;
}
