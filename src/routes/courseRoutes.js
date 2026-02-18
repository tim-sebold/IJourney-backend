import express from 'express';
import {
    getMilestoneResponse,
    getMilestoneContent,
    submitMilestoneResponse,
    unlockNextMilestone
} from '../controllers/courseController.js';

const router = express.Router();

router.get('/:milestoneId/getResponse', getMilestoneResponse);

router.get('/:milestoneId', getMilestoneContent);

router.post('/:milestoneId/submit', submitMilestoneResponse);

router.post('/unlock', unlockNextMilestone);

export default router;
