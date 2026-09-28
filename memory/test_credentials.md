# Test Credentials

## Regular user (for general testing)
- username: demo_user
- email: demo@aura.test
- password: Test@1234

## Super Admin (platform admin, community properties)
- username: superadmin
- email: admin@aurainfra.ai
- password: (unknown — not reset; ask user or reset if needed)

Notes:
- Backend requires JWT_SECRET (set in backend/.env). CORS_ORIGINS present.
- New: is_admin flag on users; /api/admin/stats now requires is_admin OR is_super_admin.
- Grant admin via: `python /app/backend/manage_admin.py grant <username>`
- Account deletion: DELETE /api/auth/account with {"password": "..."} + Bearer token.
