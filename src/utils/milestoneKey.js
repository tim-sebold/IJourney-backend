export const normalizeMilestoneKey = (value) => {
    if (typeof value !== "string") return "";
    return value.trim().replaceAll("/", "_");
};

export const toProgressMilestoneKey = (value) => {
    if (typeof value !== "string") return "";
    return value.trim().replace(/^milestone(\d+)[/_](\d+)$/, "milestone$1/$2");
};
