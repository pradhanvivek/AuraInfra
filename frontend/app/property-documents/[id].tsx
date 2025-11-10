import { useLocalSearchParams } from 'expo-router';
import DocumentsScreen from '../../screens/property/DocumentsScreen';

export default function PropertyDocumentsRoute() {
  const { id } = useLocalSearchParams();
  return <DocumentsScreen propertyId={id as string} />;
}
