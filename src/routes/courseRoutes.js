import express from 'express';
import {
    getMilestoneResponse,
    getMilestoneContent,
    submitMilestoneResponse,
    unlockNextMilestone,
    saveDraftResponse,
    getAllMilestones,
    getAllResponses,
    getStatementFeedback,
} from '../controllers/courseController.js';

const router = express.Router();

router.get('/', getAllMilestones);

router.post('/unlock', unlockNextMilestone);

// Declared ahead of `/:milestoneId`, which would otherwise swallow it.
router.get('/responses', getAllResponses);

router.post('/statement-feedback', getStatementFeedback);

router.get('/:milestoneId/getResponse', getMilestoneResponse);

router.get('/:milestoneId', getMilestoneContent);

router.post('/:milestoneId/submit', submitMilestoneResponse);

router.post('/:milestoneId/draft', saveDraftResponse);

export default router;
