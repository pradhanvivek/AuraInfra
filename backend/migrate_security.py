"""Audit by default; --apply quarantines legacy memberships/content and adds indexes.

Run against the intended database before deploying the session/authorization changes.
Take a database backup first. Duplicate groups require an operator decision, never
an automatic merge that could turn an unverified membership into approved access.
"""
import argparse
import asyncio
import os
import uuid
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


async def main(apply=False):
    load_dotenv(Path(__file__).parent / '.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    specs = {
        'property_memberships': ['user_id', 'property_id'],
        'pending_user_approvals': ['user_id', 'property_id'],
        'users': ['username'],
        'property_admin_assignments': ['admin_user_id', 'property_id'],
    }
    duplicates = 0
    for collection, fields in specs.items():
        rows = await db[collection].aggregate([
            {'$group': {'_id': {field: '$' + field for field in fields}, 'count': {'$sum': 1}}},
            {'$match': {'count': {'$gt': 1}}},
        ]).to_list(length=None)
        print(f'{collection}: {len(rows)} duplicate key groups')
        duplicates += len(rows)
    emails = await db.users.aggregate([
        {'$match': {'email': {'$type': 'string'}}}, {'$group': {'_id': {'$toLower': {'$trim': {'input': '$email'}}}, 'count': {'$sum': 1}}},
        {'$match': {'count': {'$gt': 1}}},
    ]).to_list(length=None)
    duplicates += len(emails)
    print(f'users: {len(emails)} duplicate email groups')
    legacy = await db.property_memberships.find({'status': 'approved'}).to_list(length=None)
    print(f'Legacy auto-approved memberships requiring review: {len(legacy)}')
    print('All existing app tokens will require a fresh sign-in after deployment.')
    print('Older posts/comments without a moderation status will be hidden until reviewed.')
    if not apply:
        print('Audit only. No data changed. Use --apply after resolving duplicate groups.')
        client.close()
        return
    if duplicates:
        client.close()
        raise SystemExit('Resolve duplicate groups before applying; no migration writes performed.')
    users = await db.users.find({'email': {'$type': 'string'}}).to_list(length=None)
    for user in users:
        await db.users.update_one({'_id': user['_id']}, {'$set': {'email': user['email'].strip().lower()}})
    for membership in legacy:
        user = await db.users.find_one({'id': membership['user_id']})
        prop = await db.community_properties.find_one({'id': membership['property_id']})
        if user and prop:
            await db.pending_user_approvals.update_one({'user_id': user['id'], 'property_id': prop['id']},
                {'$set': {'status': 'pending', 'username': user['username'], 'email': user.get('email') or '',
                    'property_name': prop['name'], 'requested_role': membership.get('role', 'resident')
                    if membership.get('role') in ['owner', 'tenant', 'resident'] else 'resident',
                    'documents': [], 'document_names': [], 'created_at': datetime.utcnow()},
                 '$setOnInsert': {'id': str(uuid.uuid4())}}, upsert=True)
        await db.property_memberships.update_one({'_id': membership['_id']}, {'$set': {'status': 'pending'}})
    # Do not silently publish old content or retain already-reviewed verification proofs.
    await db.community_posts.update_many({'moderation_status': {'$exists': False}}, {'$set': {'moderation_status': 'pending'}})
    await db.community_comments.update_many({'moderation_status': {'$exists': False}}, {'$set': {'moderation_status': 'pending'}})
    await db.pending_user_approvals.update_many({'status': {'$in': ['approve', 'reject', 'approved', 'rejected']}},
        {'$set': {'documents': [], 'document_names': []}})
    for collection, fields in specs.items():
        await db[collection].create_index([(field, 1) for field in fields], unique=True)
    await db.users.create_index('email', unique=True, partialFilterExpression={'email': {'$type': 'string'}})
    await db.property_admin_assignments.create_index([('admin_user_id', 1), ('property_id', 1)], unique=True)
    print('Migration applied. Review pending memberships and queued content before rollout.')
    client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    asyncio.run(main(parser.parse_args().apply))
