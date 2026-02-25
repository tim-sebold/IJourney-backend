import { getFirestore } from 'firebase-admin/firestore';
import { getChatbotResponse } from '../services/vertexAIservice.js';
import { extractFormFields } from '../utils/formParser.js';

const db = getFirestore();

export const handleChatMessage = async (req, res) => {
    try {
        const { userId, sessionId, message } = req.body;

        if (!userId || !message)
            return res.status(400).json({ error: 'Missing userId or message' });

        const aiResponse = await getChatbotResponse(sessionId, message);
        const formFields = extractFormFields(aiResponse);

        await db.collection('sessions').doc(sessionId).collection('messages').add({
            userId,
            message,
            aiResponse,
            formFields,
            createdAt: new Date(),
        });

        if (formFields && Object.keys(formFields).length > 0) {
            await db.collection('responses').add({
                userId,
                sessionId,
                data: formFields,
                createdAt: new Date(),
            });
        }

        res.status(200).json({
            success: true,
            data: {
                aiResponse,
                formFields
            },
            message: 'Message sent successfully',
        });
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const startChatSession = async (req, res) => {
    try {
        const { userId, milestoneId } = req.body;
        const sessionRef = await db.collection('sessions').add({
            userId,
            milestoneId,
            createdAt: new Date(),
            status: 'active',
        });

        res.json({
            message: 'Session started successfully',
            data: {
                sessionId: sessionRef.id
            },
            success: true
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getChatHistory = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const snapshot = await db
            .collection('sessions')
            .doc(sessionId)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .get();

        const messages = snapshot.docs.map(doc => doc.data());
        res.json({
            success: true,
            message: 'Chat history fetched successfully',
            data: { messages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const endChatSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        await db.collection('sessions').doc(sessionId).update({
            status: 'completed',
            endedAt: new Date(),
        });

        res.json({
            success: true,
            message: 'Session closed successfully',
            data: ""
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
