/**
 * Single source of truth for the course structure.
 *
 * Every gate in the app (unlocking, completion, certificate issuance, progress
 * totals) derives from this list. `requiresResponse: true` means the milestone
 * collects work from the user and may only be completed once a matching
 * `responses/{uid}/milestones/{key}` document exists with `status: 'submitted'`.
 * `requiresResponse: false` marks a read-only content page that has nothing to
 * submit — those are completed by visiting them, and are whitelisted here rather
 * than laundered through a synthetic response document.
 *
 * Keys are in *progress* form (`milestone1/4`). Use `toResponseKey` for the
 * `responses` collection, which uses underscores.
 */

const MILESTONES = [
    { key: 'milestone0/1', requiresResponse: false },
    { key: 'milestone0/2', requiresResponse: true },

    { key: 'milestone1/1', requiresResponse: false },
    { key: 'milestone1/2', requiresResponse: false },
    { key: 'milestone1/3', requiresResponse: false },
    { key: 'milestone1/4', requiresResponse: true },
    { key: 'milestone1/5', requiresResponse: true },
    { key: 'milestone1/6', requiresResponse: true },
    { key: 'milestone1/7', requiresResponse: true },

    { key: 'milestone2/1', requiresResponse: true },
    { key: 'milestone2/2', requiresResponse: false },
    { key: 'milestone2/3', requiresResponse: true },
    { key: 'milestone2/4', requiresResponse: true },
    { key: 'milestone2/5', requiresResponse: true },
    { key: 'milestone2/6', requiresResponse: true },
    { key: 'milestone2/7', requiresResponse: false },
    { key: 'milestone2/8', requiresResponse: true },
    { key: 'milestone2/9', requiresResponse: true },
    { key: 'milestone2/10', requiresResponse: true },
    { key: 'milestone2/11', requiresResponse: true },
    { key: 'milestone2/12', requiresResponse: false },
    { key: 'milestone2/13', requiresResponse: false },

    { key: 'milestone3/1', requiresResponse: false },
    { key: 'milestone3/2', requiresResponse: false },
    { key: 'milestone3/3', requiresResponse: true },
    { key: 'milestone3/4', requiresResponse: true },
    { key: 'milestone3/5', requiresResponse: true },
    { key: 'milestone3/6', requiresResponse: false },
    { key: 'milestone3/7', requiresResponse: true },

    { key: 'milestone4/1', requiresResponse: false },
    { key: 'milestone4/2', requiresResponse: true },
    { key: 'milestone4/3', requiresResponse: true },
    { key: 'milestone4/4', requiresResponse: true },
    { key: 'milestone4/5', requiresResponse: true },

    { key: 'milestone5/1', requiresResponse: true },
    { key: 'milestone5/2', requiresResponse: false },
    { key: 'milestone5/3', requiresResponse: false },
    { key: 'milestone5/4', requiresResponse: false },
    { key: 'milestone5/5', requiresResponse: true },

    { key: 'milestone6/1', requiresResponse: false },
    { key: 'milestone6/2', requiresResponse: false },
    { key: 'milestone6/3', requiresResponse: true },
    { key: 'milestone6/4', requiresResponse: false },
    { key: 'milestone6/5', requiresResponse: false },

    { key: 'milestone7/1', requiresResponse: false },
    { key: 'milestone7/2', requiresResponse: true },
    { key: 'milestone7/3', requiresResponse: false },
    { key: 'milestone7/4', requiresResponse: false },
    { key: 'milestone7/5', requiresResponse: false },
];

/** Sentinel used by the client as `prevMilestoneId` on the very first unlock. */
export const START_KEY = 'start';

/** Sentinel used by the client as `milestoneId` after the final milestone. */
export const COMPLETED_KEY = 'completed';

/** The page that hosts the certificate download. */
export const CERTIFICATE_MILESTONE_KEY = 'milestone7/4';

export const MILESTONE_ORDER = MILESTONES.map((m) => m.key);

export const TOTAL_MILESTONES = MILESTONES.length;

/** Progress-form keys of every milestone that must have a submitted response. */
export const REQUIRED_RESPONSE_KEYS = MILESTONES
    .filter((m) => m.requiresResponse)
    .map((m) => m.key);

const BY_KEY = new Map(MILESTONES.map((m) => [m.key, m]));
const INDEX_BY_KEY = new Map(MILESTONE_ORDER.map((key, index) => [key, index]));

export const isKnownMilestone = (key) => BY_KEY.has(key);

export const requiresResponse = (key) => BY_KEY.get(key)?.requiresResponse === true;

export const milestoneIndex = (key) => (INDEX_BY_KEY.has(key) ? INDEX_BY_KEY.get(key) : -1);

/**
 * True when `key` is the step that legitimately follows `prevKey`. `start`
 * precedes the first milestone and `completed` follows the last one, so the
 * whole course is a single unbroken chain no request can jump across.
 */
export const isImmediateSuccessor = (prevKey, key) => {
    if (prevKey === START_KEY) return key === MILESTONE_ORDER[0];
    if (key === COMPLETED_KEY) return prevKey === MILESTONE_ORDER[MILESTONE_ORDER.length - 1];

    const prevIndex = milestoneIndex(prevKey);
    const index = milestoneIndex(key);
    if (prevIndex === -1 || index === -1) return false;

    return index === prevIndex + 1;
};

/** `milestone1/4` -> `milestone1_4` (the `responses` collection document id). */
export const toResponseKey = (key) => key.replaceAll('/', '_');
