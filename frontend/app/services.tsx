import { useCallback, useState } from 'react';
import { ScrollView, View, Text, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../services/config';

type Service = { id: string; name: string; category: string; vendor_name: string; description: string };
type Booking = { id: string; service_name: string; vendor_name: string; status: string; preferred_at: string; instructions: string; history: { status: string; note?: string }[] };
export default function ServicesScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ role: string; services: Service[]; bookings: Booking[] } | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('laundry');
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [time, setTime] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const base = `${API_URL}/api/properties/${encodeURIComponent(propertyId || '')}/services`;
  const load = useCallback(async () => {
    if (!propertyId) { setError(true); return; }
    try { const response = await axios.get(base, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); setData(response.data); setError(false); }
    catch { setData(null); setError(true); }
  }, [base, token, propertyId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function mutate(path: string, body: unknown, method: 'post' | 'put' | 'delete' = 'post') {
    if (busy) return;
    setBusy(true);
    try { await axios.request({ url: `${base}${path}`, method, data: body, headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); await load(); }
    catch (err) { Alert.alert('Unable to update', axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Check required fields and your chosen time.'); }
    finally { setBusy(false); }
  }
  function book(service: Service) {
    const date = new Date(time[service.id] || '');
    if (!Number.isFinite(date.getTime())) { Alert.alert('Choose a future time', 'Enter a local date and time such as 2026-10-15T10:30.'); return; }
    void mutate('/bookings', { service_id: service.id, instructions: instructions[service.id], preferred_at: date.toISOString() });
  }
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Button title="Back to community" onPress={() => router.replace('/(tabs)')} />
    <Text style={{ fontSize: 26, fontWeight: '700' }}>Local services</Text>
    <Text>Request a service from providers listed by your association. The association confirms availability, timing and price. Payment is arranged with the provider.</Text>
    {error ? <View><Text>Unable to load services.</Text><Button title="Retry" onPress={() => void load()} /></View> : !data ? <ActivityIndicator /> : <>
      {data.role === 'admin' && <View style={{ padding: 16, backgroundColor: '#EFF4FB', gap: 10 }}>
        <Text style={{ fontWeight: '700' }}>Add a community service</Text>
        <TextInput accessibilityLabel="Service name" placeholder="Service name" value={name} onChangeText={setName} />
        <TextInput accessibilityLabel="Vendor name" placeholder="Vendor name" value={vendor} onChangeText={setVendor} />
        <TextInput accessibilityLabel="Service description" placeholder="Description and how pricing works" value={description} onChangeText={setDescription} multiline />
        <Text>Category</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['laundry', 'car_wash', 'food', 'repairs', 'other'].map(value => <Button key={value} title={(category === value ? '✓ ' : '') + value.replaceAll('_', ' ')} onPress={() => setCategory(value)} />)}</View>
        <Button disabled={busy || !name.trim() || !vendor.trim() || !description.trim()} title="Add service" onPress={() => void mutate('', { name, vendor_name: vendor, description, category })} />
      </View>}
      {!data.services.length && <Text>No providers have been listed for this community yet.</Text>}
      {data.services.map(service => <View key={service.id} style={{ padding: 16, backgroundColor: '#F5F7FB', gap: 10, borderRadius: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>{service.name}</Text><Text>{service.vendor_name} · {service.category.replaceAll('_', ' ')}</Text><Text>{service.description}</Text>
        {data.role !== 'security' && <>
          <TextInput accessibilityLabel={`Instructions for ${service.name}`} placeholder="Your unit and service instructions" value={instructions[service.id] || ''} onChangeText={value => setInstructions(previous => ({ ...previous, [service.id]: value }))} multiline style={{ padding: 12, backgroundColor: '#fff' }} />
          <TextInput accessibilityLabel={`Preferred time for ${service.name}`} placeholder="Preferred local time: YYYY-MM-DDTHH:mm" value={time[service.id] || ''} onChangeText={value => setTime(previous => ({ ...previous, [service.id]: value }))} style={{ padding: 12, backgroundColor: '#fff' }} />
          <Button disabled={busy || !instructions[service.id]?.trim() || !time[service.id]} title="Request booking" onPress={() => book(service)} />
        </>}
        {data.role === 'admin' && <Button disabled={busy} title="Remove listing" onPress={() => void mutate(`/${service.id}`, undefined, 'delete')} />}
      </View>)}
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Bookings</Text>
      {!data.bookings.length && <Text>No booking requests yet.</Text>}
      {data.bookings.map(booking => <View key={booking.id} style={{ padding: 16, backgroundColor: '#F5F7FB', gap: 10 }}>
        <Text style={{ fontWeight: '600' }}>{booking.service_name} · {booking.status.replaceAll('_', ' ')}</Text><Text>{booking.vendor_name} · {new Date(booking.preferred_at).toLocaleString()}</Text><Text>{booking.instructions}</Text>
        {!['completed', 'cancelled'].includes(booking.status) && (data.role === 'admin' || booking.status === 'requested') && <>
          <TextInput accessibilityLabel="Booking update note" placeholder="Required update / cancellation note" value={notes[booking.id] || ''} onChangeText={value => setNotes(previous => ({ ...previous, [booking.id]: value }))} />
          {data.role === 'admin' && <Button disabled={busy || !notes[booking.id]?.trim()} title={booking.status === 'requested' ? 'Confirm booking' : booking.status === 'confirmed' ? 'Start service' : 'Mark completed'} onPress={() => void mutate(`/bookings/${booking.id}`, { status: booking.status === 'requested' ? 'confirmed' : booking.status === 'confirmed' ? 'in_progress' : 'completed', note: notes[booking.id] }, 'put')} />}
          <Button disabled={busy || !notes[booking.id]?.trim()} title="Cancel request" onPress={() => void mutate(`/bookings/${booking.id}`, { status: 'cancelled', note: notes[booking.id] }, 'put')} />
        </>}
        {booking.history.map((event, index) => <Text key={index}>{event.status.replaceAll('_', ' ')}{event.note ? ` · ${event.note}` : ''}</Text>)}
      </View>)}
    </>}
  </ScrollView>;
}
