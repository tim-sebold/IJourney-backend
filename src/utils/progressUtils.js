export const calculateProgress = (progressData) => {
    const completed = progressData.filter(p => p.completed).length;
    const total = 49;
    const currentMilestone = progressData.find(p => !p.completed)?.milestoneId || 0;
    
    return { completed, total, currentMilestone, percent: (completed / total) * 100 };
};
