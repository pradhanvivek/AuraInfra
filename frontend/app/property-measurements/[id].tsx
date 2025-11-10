import { useLocalSearchParams } from 'expo-router';
import MeasurementsScreen from '../../screens/property/MeasurementsScreen';

export default function PropertyMeasurementsRoute() {
  const { id } = useLocalSearchParams();
  return <MeasurementsScreen propertyId={id as string} />;
}
