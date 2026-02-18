import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { SessionsClient } from "@google-cloud/dialogflow-cx";

const client = new PredictionServiceClient();

const projectId = "your-project-id";
const location = "global";
const agentId = "your-agent-id";

const sessionClient = new SessionsClient();
const sessionPath = sessionClient.projectLocationAgentSessionPath(
    projectId, location, agentId, "unique-session-id"
);

export const sendToChatbot = async (text) => {
    const request = {
        session: sessionPath,
        queryInput: {
            text: { text },
            languageCode: "en-US",
        },
    };
    const [response] = await sessionClient.detectIntent(request);
    return response.queryResult.responseMessages;
};


export const getChatbotResponse = async (sessionId, message) => {
    const [response] = await client.predict({
        endpoint: process.env.VERTEX_AI_CHATBOT_ENDPOINT,
        instances: [{ context: sessionId, content: message }],
        parameters: { temperature: 0.7 },
    });

    return response.predictions[0]?.content || 'Sorry, I didn’t understand that.';
};
