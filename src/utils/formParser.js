export const extractFormFields = (aiText) => {
    const result = {};

    if (aiText.includes("Emotion:")) {
        const match = aiText.match(/Emotion:\s*(\w+)/i);
        if (match) result.emotion = match[1];
    }

    if (aiText.includes("Goal:")) {
        const match = aiText.match(/Goal:\s*(.+)/i);
        if (match) result.goal = match[1];
    }

    return result;
};
