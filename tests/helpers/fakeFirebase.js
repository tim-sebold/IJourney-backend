/**
 * An in-memory stand-in for the slice of the Admin SDK the controllers use, so
 * the gates can be driven over real HTTP without a Firebase project.
 *
 * Documents live in one flat map keyed by full path (`responses/u1/milestones/m`).
 * `set(..., { merge: true })` merges nested maps the way Firestore does, which
 * matters for `progress/{uid}`: unlocking and completing write to the same key.
 */
const isPlainObject = (value) =>
    !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const deepMerge = (target, source) => {
    const out = { ...target };
    for (const [key, value] of Object.entries(source)) {
        out[key] = isPlainObject(value) && isPlainObject(out[key])
            ? deepMerge(out[key], value)
            : value;
    }
    return out;
};

export function createFakeFirebase() {
    const docs = new Map();
    const authUsers = new Map();
    let nextUid = 1;

    const snapshot = (path) => ({
        id: path.split('/').pop(),
        exists: docs.has(path),
        data: () => (docs.has(path) ? structuredClone(docs.get(path)) : undefined),
    });

    const docRef = (path) => ({
        id: path.split('/').pop(),
        get: async () => snapshot(path),
        set: async (data, options) => {
            const merged = options?.merge && docs.has(path) ? deepMerge(docs.get(path), data) : data;
            docs.set(path, structuredClone(merged));
        },
        update: async (data) => {
            if (!docs.has(path)) throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
            docs.set(path, structuredClone({ ...docs.get(path), ...data }));
        },
        create: async (data) => {
            if (docs.has(path)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
            docs.set(path, structuredClone(data));
        },
        collection: (name) => collectionRef(`${path}/${name}`),
    });

    const childDocs = (path, filters = []) =>
        [...docs.keys()]
            .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
            .filter((key) => filters.every(([field, value]) =>
                field.split('.').reduce((node, part) => node?.[part], docs.get(key)) === value))
            .map(snapshot);

    const query = (path, filters) => ({
        where: (field, _op, value) => query(path, [...filters, [field, value]]),
        limit: () => query(path, filters),
        get: async () => {
            const found = childDocs(path, filters);
            return { docs: found, size: found.length, empty: found.length === 0 };
        },
        count: () => ({
            get: async () => ({ data: () => ({ count: childDocs(path, filters).length }) }),
        }),
    });

    const collectionRef = (path) => ({
        ...query(path, []),
        doc: (id) => docRef(`${path}/${id}`),
    });

    const db = { collection: (name) => collectionRef(name) };

    const auth = {
        // Test tokens are `uid` or `uid:role`.
        verifyIdToken: async (token) => {
            const [uid, role] = String(token).split(':');
            if (!uid) throw new Error('bad token');
            return { uid, ...(role ? { role } : {}) };
        },
        createUser: async ({ email, displayName }) => {
            if ([...authUsers.values()].some((user) => user.email === email)) {
                throw new Error('The email address is already in use by another account.');
            }
            const uid = `uid${nextUid++}`;
            authUsers.set(uid, { uid, email, displayName });
            return { uid };
        },
        deleteUser: async (uid) => { authUsers.delete(uid); },
        setCustomUserClaims: async () => {},
        revokeRefreshTokens: async () => {},
    };

    const admin = {
        auth: () => auth,
        firestore: { FieldValue: { serverTimestamp: () => new Date() } },
    };

    return {
        admin,
        db,
        authUsers,
        /** Reads a document straight out of the store, by full path. */
        read: (path) => (docs.has(path) ? structuredClone(docs.get(path)) : undefined),
        /** Seeds a document, by full path. */
        seed: (path, data) => { docs.set(path, structuredClone(data)); },
        reset: () => { docs.clear(); authUsers.clear(); nextUid = 1; },
    };
}
