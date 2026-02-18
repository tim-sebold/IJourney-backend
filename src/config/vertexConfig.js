export const vertexAIConfig = {
    location: "us-central1",
    model: "chat-bison",
    endpoint: `https://us-central1-aiplatform.googleapis.com/v1/projects/${process.env.PROJECT_ID}/locations/us-central1/publishers/google/models/chat-bison:predict`,
};
