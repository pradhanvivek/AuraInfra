from datetime import datetime, timedelta, timezone
from test_security_regressions import api, headers, run, server


def test_flags_defaults_and_permissions(api):
    client, tokens = api
    assert client.get('/api/app-config').status_code in (401, 403)
    assert client.get('/api/app-config', headers=headers(tokens, 'resident-a')).json() == {'community': True, 'assets': True}
    values = {'community': False, 'assets': True}
    assert client.put('/api/admin/super/app-config', json=values, headers=headers(tokens, 'admin-a')).status_code == 403
    run(server.db.users.update_one({'id': 'admin-a'}, {'$set': {'is_super_admin': True}}))
    assert client.put('/api/admin/super/app-config', json=values, headers=headers(tokens, 'admin-a')).json() == values
    assert client.get('/api/app-config', headers=headers(tokens, 'resident-b')).json() == values
    assert client.put('/api/admin/super/app-config', json={'community': 'false', 'assets': True}, headers=headers(tokens, 'admin-a')).status_code == 422
    assert client.put('/api/admin/super/app-config', json={'community': True, 'assets': True, 'other': True}, headers=headers(tokens, 'admin-a')).status_code == 422
    assert run(server.db.app_configuration.count_documents({})) == 1
    assert client.put('/api/admin/super/app-config', json={'community': False, 'assets': False}, headers=headers(tokens, 'admin-a')).status_code == 200


def test_manual_db_flags(api):
    client, tokens = api
    run(server.db.app_configuration.insert_one({'_id': 'resident-app', 'community': False, 'assets': 'false'}))
    assert client.get('/api/app-config', headers=headers(tokens, 'resident-a')).json() == {'community': False, 'assets': True}


def new_run(client, tokens):
    base = '/api/properties/a/sops'
    response = client.post(base + '/templates', json={'title': 'Pump inspection', 'steps': ['Read pressure', 'Check leaks']}, headers=headers(tokens, 'admin-a'))
    assert response.status_code == 201
    payload = {'template_id': response.json()['id'], 'assignee_id': 'resident-a', 'due_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}
    response = client.post(base + '/runs', json=payload, headers=headers(tokens, 'admin-a'))
    assert response.status_code == 201
    return response.json()['id'], payload


def test_sop_workflow_and_cross_community_access(api):
    client, tokens = api
    base = '/api/properties/a/sops'
    assert client.post(base + '/templates', json={'title': 'Check', 'steps': ['Read']}, headers=headers(tokens, 'resident-a')).status_code == 403
    ident, payload = new_run(client, tokens)
    for user in ['resident-b', 'admin-b', 'outsider', 'pending-a']:
        assert client.get(base, headers=headers(tokens, user)).status_code == 403
        assert client.put(f'{base}/runs/{ident}/steps/0', json={'evidence': 'Checked'}, headers=headers(tokens, user)).status_code == 403
    payload['assignee_id'] = 'resident-b'
    assert client.post(base + '/runs', json=payload, headers=headers(tokens, 'admin-a')).status_code == 403
    assert client.get(base, headers=headers(tokens, 'security-a')).json()['runs'] == []
    assert client.put(f'{base}/runs/{ident}/steps/0', json={'evidence': 'Checked'}, headers=headers(tokens, 'security-a')).status_code == 403
    assert client.post(f'{base}/runs/{ident}/submit', headers=headers(tokens, 'resident-a')).status_code == 409
    assert client.put(f'{base}/runs/{ident}/steps/0', json={'evidence': ' '}, headers=headers(tokens, 'resident-a')).status_code == 422
    for index in [0, 1]:
        assert client.put(f'{base}/runs/{ident}/steps/{index}', json={'evidence': 'Observed normal operation'}, headers=headers(tokens, 'resident-a')).status_code == 200
    assert client.post(f'{base}/runs/{ident}/submit', headers=headers(tokens, 'resident-a')).json()['status'] == 'awaiting_approval'
    assert client.put(f'{base}/runs/{ident}/steps/0', json={'evidence': 'Changed'}, headers=headers(tokens, 'admin-a')).status_code == 409
    review = f'{base}/runs/{ident}/review'
    assert client.post(review, json={'decision': 'approve', 'note': 'Verified'}, headers=headers(tokens, 'resident-a')).status_code == 403
    reopened = client.post(review, json={'decision': 'reopen', 'note': 'Repeat readings'}, headers=headers(tokens, 'admin-a')).json()
    assert reopened['status'] == 'open' and not any(s['completed'] for s in reopened['steps'])
    for index in [0, 1]:
        client.put(f'{base}/runs/{ident}/steps/{index}', json={'evidence': 'Rechecked'}, headers=headers(tokens, 'resident-a'))
    client.post(f'{base}/runs/{ident}/submit', headers=headers(tokens, 'resident-a'))
    approved = client.post(review, json={'decision': 'approve', 'note': 'Verified'}, headers=headers(tokens, 'admin-a')).json()
    assert approved['status'] == 'approved' and len(approved['history']) == 9
    assert client.post(review, json={'decision': 'reopen', 'note': 'Again'}, headers=headers(tokens, 'admin-a')).status_code == 409


def test_service_booking_permissions_and_lifecycle(api):
    client, tokens = api
    base = '/api/properties/a/services'
    listing = {'name': 'Weekly car wash', 'category': 'car_wash', 'vendor_name': 'Local provider', 'description': 'Price confirmed before service'}
    assert client.post(base, json=listing, headers=headers(tokens, 'resident-a')).status_code == 403
    created = client.post(base, json=listing, headers=headers(tokens, 'admin-a'))
    assert created.status_code == 201
    service_id = created.json()['id']
    payload = {'service_id': service_id, 'instructions': 'Unit A-101', 'preferred_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}
    assert client.post(base + '/bookings', json=payload, headers=headers(tokens, 'resident-b')).status_code == 403
    assert client.post('/api/properties/b/services/bookings', json=payload, headers=headers(tokens, 'resident-b')).status_code == 404
    assert client.post(base + '/bookings', json=payload, headers=headers(tokens, 'security-a')).status_code == 403
    booking = client.post(base + '/bookings', json=payload, headers=headers(tokens, 'resident-a')).json()
    path = base + '/bookings/' + booking['id']
    assert client.get(base, headers=headers(tokens, 'security-a')).json()['bookings'] == []
    assert client.put(path, json={'status': 'confirmed', 'note': 'Confirmed'}, headers=headers(tokens, 'resident-a')).status_code == 403
    assert client.put(path, json={'status': 'completed', 'note': 'Done'}, headers=headers(tokens, 'admin-a')).status_code == 409
    for status in ['confirmed', 'in_progress', 'completed']:
        response = client.put(path, json={'status': status, 'note': 'Verified by manager'}, headers=headers(tokens, 'admin-a'))
        assert response.status_code == 200 and response.json()['status'] == status
    assert client.put(path, json={'status': 'cancelled', 'note': 'Cancel'}, headers=headers(tokens, 'resident-a')).status_code == 403
    assert client.delete(base + '/' + service_id, headers=headers(tokens, 'admin-a')).status_code == 204
    assert not client.get(base, headers=headers(tokens, 'resident-a')).json()['services']
    assert client.post(base + '/bookings', json=payload, headers=headers(tokens, 'resident-a')).status_code == 404
    assert len(client.get(base, headers=headers(tokens, 'resident-a')).json()['bookings']) == 1


def test_account_deletion_cleans_new_workflow_records(api):
    client, tokens = api
    ident, payload = new_run(client, tokens)
    client.put(f'/api/properties/a/sops/runs/{ident}/steps/0', json={'evidence': 'Private observations'}, headers=headers(tokens, 'resident-a'))
    run(server.db.service_bookings.insert_one({'id': 'booking-private', 'property_id': 'a', 'user_id': 'resident-a'}))
    run(server.db.service_bookings.insert_one({'id': 'booking-other', 'property_id': 'a', 'user_id': 'admin-a', 'history': [{'by': 'resident-a', 'note': 'Personal details'}]}))
    job = {'id': 'delete-resident', 'user_id': 'resident-a', 'property_ids': [], 'post_ids': [], 'meeting_ids': []}
    run(server.db.account_deletions.insert_one(dict(job)))
    run(server.clean_account(server.db, job))
    record = run(server.db.sop_runs.find_one({'id': ident}))
    assert record['assignee_id'] == 'deleted'
    assert record['steps'][0]['completed_by'] == 'deleted'
    assert 'Private' not in record['steps'][0]['evidence']
    assert record['history'][-1]['by'] == 'deleted'
    assert not run(server.db.service_bookings.find_one({'id': 'booking-private'}))
    assert run(server.db.service_bookings.find_one({'id': 'booking-other'}))['history'][0]['by'] == 'deleted'
