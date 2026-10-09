import { useCallback, useState } from 'react';
import { ScrollView, View, Text, TextInput, Button, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../services/config';

type Run = { id: string; title: string; assignee_id: string; status: string; due_at: string; steps: { text: string; completed: boolean; evidence?: string }[]; history: { action: string; by: string; note?: string }[] };
type Template = { id: string; title: string };
export default function SOPScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token, userId } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ role: string; templates: Template[]; runs: Run[] } | null>(null);
  const [members, setMembers] = useState<{ user_id: string; username: string; unit_number?: string }[]>([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [assignee, setAssignee] = useState('');
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const base = `${API_URL}/api/properties/${encodeURIComponent(propertyId || '')}/sops`;
  const load = useCallback(async () => {
    if (!propertyId) { setError(true); return; }
    try {
      const response = await axios.get(base, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      let activeMembers: { user_id: string; username: string; unit_number?: string }[] = [];
      if (response.data.role === 'admin') {
        const result = await axios.get(`${API_URL}/api/properties/${encodeURIComponent(propertyId)}/members`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        activeMembers = result.data.filter((member: { status: string }) => member.status === 'active');
      }
      setMembers(activeMembers); setData(response.data); setNow(Date.now()); setError(false);
    } catch { setData(null); setError(true); }
  }, [base, token, propertyId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function mutate(path: string, body: unknown, method: 'post' | 'put' = 'post') {
    if (busy) return;
    setBusy(true);
    try { await axios[method](`${base}${path}`, body, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); await load(); }
    catch (err) { const message = axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Check the required fields and try again.'; Alert.alert('Unable to update SOP', message); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Button title="Back to community" onPress={() => router.replace('/(tabs)')} />
    <Text style={{ fontSize: 26, fontWeight: '700' }}>Association SOPs</Text>
    <Text>Complete each checklist step with evidence, then submit for administrator approval.</Text>
    {error ? <View><Text>Unable to load SOPs for this community.</Text><Button title="Retry" onPress={() => void load()} /></View> : !data ? <ActivityIndicator /> : <>
      {data.role === 'admin' && <View style={{ gap: 12, padding: 16, backgroundColor: '#EFF4FB', borderRadius: 12 }}>
        <Text style={{ fontWeight: '700' }}>Create an SOP template</Text>
        <TextInput accessibilityLabel="SOP title" placeholder="e.g. Water pump inspection" value={title} onChangeText={setTitle} style={{ backgroundColor: '#fff', padding: 12 }} />
        <TextInput accessibilityLabel="Checklist steps" multiline placeholder="One checklist step per line" value={steps} onChangeText={setSteps} style={{ backgroundColor: '#fff', padding: 12, minHeight: 90 }} />
        <Button disabled={busy || !title.trim() || !steps.trim()} title="Save template" onPress={() => void mutate('/templates', { title, steps: steps.split('\n').map(s => s.trim()).filter(Boolean) })} />
        <Text>Choose who should complete this run. Initial runs are due in 24 hours.</Text>
        <Button title={(assignee === '' ? '✓ ' : '') + 'Assign to me'} onPress={() => setAssignee('')} />
        {members.filter(member => member.user_id !== userId).map(member => <Button key={member.user_id} title={(assignee === member.user_id ? '✓ ' : '') + member.username + (member.unit_number ? ` · ${member.unit_number}` : '')} onPress={() => setAssignee(member.user_id)} />)}
        {data.templates.map(template => <Button key={template.id} disabled={busy} title={`Start: ${template.title}`} onPress={() => void mutate('/runs', { template_id: template.id, assignee_id: assignee.trim() || userId, due_at: new Date(Date.now() + 86400000).toISOString() })} />)}
      </View>}
      {!data.runs.length && <Text>No SOP runs assigned yet.</Text>}
      {data.runs.map(run => <View key={run.id} style={{ padding: 16, gap: 12, backgroundColor: '#F5F7FB', borderRadius: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>{run.title}</Text>
        <Text>Status: {run.status.replaceAll('_', ' ')} · Due: {new Date(run.due_at).toLocaleString()}</Text>
        {run.status !== 'approved' && new Date(run.due_at).getTime() < now && <Text style={{ color: '#B42318' }}>Overdue</Text>}
        <Text>Assigned to: {run.assignee_id === userId ? 'You' : members.find(member => member.user_id === run.assignee_id)?.username || 'Community team member'}</Text>
        {run.steps.map((step, index) => {
          const key = `${run.id}:${index}`;
          return <View key={key} style={{ gap: 8 }}>
            <Text>{step.completed ? '✓' : '○'} {step.text}</Text>
            {step.evidence && <Text>Evidence: {step.evidence}</Text>}
            {run.status === 'open' && !step.completed && <>
              <TextInput accessibilityLabel={`Evidence for ${step.text}`} placeholder="Completion evidence / readings / observations" multiline value={evidence[key] || ''} onChangeText={value => setEvidence(previous => ({ ...previous, [key]: value }))} style={{ backgroundColor: '#fff', padding: 12 }} />
              <Button disabled={busy || !evidence[key]?.trim()} title="Complete step" onPress={() => void mutate(`/runs/${run.id}/steps/${index}`, { evidence: evidence[key] }, 'put')} />
            </>}
          </View>;
        })}
        {run.status === 'open' && <Button disabled={busy || !run.steps.every(step => step.completed)} title="Submit for approval" onPress={() => void mutate(`/runs/${run.id}/submit`, {})} />}
        {run.status === 'awaiting_approval' && data.role === 'admin' && <>
          <TextInput accessibilityLabel="Review note" placeholder="Required review note" value={notes[run.id] || ''} onChangeText={value => setNotes(previous => ({ ...previous, [run.id]: value }))} style={{ backgroundColor: '#fff', padding: 12 }} />
          <Button disabled={busy || !notes[run.id]?.trim()} title="Approve completion" onPress={() => void mutate(`/runs/${run.id}/review`, { decision: 'approve', note: notes[run.id] })} />
          <Button disabled={busy || !notes[run.id]?.trim()} title="Reopen for corrections" onPress={() => void mutate(`/runs/${run.id}/review`, { decision: 'reopen', note: notes[run.id] })} />
        </>}
        <Text style={{ fontWeight: '600' }}>Activity history</Text>
        {run.history.map((event, index) => <Text key={index}>{event.action.replaceAll('_', ' ')}{event.note ? ` · ${event.note}` : ''}</Text>)}
      </View>)}
    </>}
  </ScrollView>;
}
