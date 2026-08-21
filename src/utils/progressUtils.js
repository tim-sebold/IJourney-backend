import { MILESTONE_ORDER, TOTAL_MILESTONES } from '../config/courseManifest.js';

/**
 * `progressData` is the progress map flattened to `{ milestoneId, completed, ... }`
 * entries. The current milestone is the first step of the course the user has not
 * finished, resolved in course order — not in whatever order Firestore returned the
 * map keys, which is lexicographic and puts `milestone2/10` before `milestone2/2`.
 */
export const calculateProgress = (progressData) => {
    const byId = new Map(progressData.map(entry => [entry.milestoneId, entry]));
    const completed = progressData.filter(p => p.completed).length;
    const total = TOTAL_MILESTONES;

    const currentMilestone = MILESTONE_ORDER.find(key => !byId.get(key)?.completed) ?? null;

    return {
        completed,
        total,
        currentMilestone,
        percent: total > 0 ? (completed / total) * 100 : 0,
    };
};
