import express from 'express';
import {
    getMilestoneResponse,
    getMilestoneContent,
    submitMilestoneResponse,
    unlockNextMilestone,
    saveDraftResponse,
    getAllMilestones,
    getStatementFeedback,
} from '../controllers/courseController.js';

const router = express.Router();

router.get('/', getAllMilestones);

router.post('/unlock', unlockNextMilestone);

router.post('/statement-feedback', getStatementFeedback);

router.get('/:milestoneId/getResponse', getMilestoneResponse);

router.get('/:milestoneId', getMilestoneContent);

router.post('/:milestoneId/submit', submitMilestoneResponse);

router.post('/:milestoneId/draft', saveDraftResponse);

export default router;
