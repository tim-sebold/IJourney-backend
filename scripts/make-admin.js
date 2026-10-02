/**
 * Grants or removes the admin role for one account.
 *
 *   npm run make-admin -- someone@example.org
 *   npm run make-admin -- someone@example.org --revoke
 *
 * This exists because the first admin cannot be created through the product:
 * `POST /api/admin/role` is itself admin-only. It runs with the same service
 * account the server uses (see `src/config/firebaseAdmin.js`), so it needs the
 * same environment — run it from this directory with `.env` in place.
 *
 * The role is a Firebase custom claim, which is what `verifyAdminRole` checks.
 * Claims are baked into the ID token, so the account must sign out and back in
 * (or wait up to an hour for the token to refresh) before the change is visible.
 */
import { admin, db } from '../src/config/firebaseAdmin.js';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run make-admin -- <email> [--revoke]');
    process.exit(1);
}

const role = revoke ? 'user' : 'admin';

try {
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role });
    await db.collection('users').doc(user.uid).set({ role }, { merge: true });

    console.log(`${email} (${user.uid}) now has the role "${role}".`);
    console.log('They must sign out and sign back in for it to take effect.');
    process.exit(0);
} catch (error) {
    if (error?.code === 'auth/user-not-found') {
        console.error(`No account exists for ${email}. They need to register first.`);
    } else {
        console.error(`Could not update ${email}: ${error?.message ?? error}`);
    }
    process.exit(1);
}
