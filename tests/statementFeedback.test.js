import {
    STATEMENT_SECTION_KEYS,
    buildStatementFeedback,
} from "../src/services/statementFeedback.js";

const STRONG = {
    iAm: "I am a patient listener because people open up when they are not rushed.",
    iBelieve: "I believe every young person deserves someone who takes them seriously.",
    iWill: "I will volunteer at two youth centres every month through 2027.",
    iAmConfident: "I am confident leading a room because I have run assemblies since year nine.",
    iAmCapable: "I am capable of finishing hard things by breaking them into weekly steps.",
};

describe("buildStatementFeedback", () => {
    it("covers all five sections", () => {
        const { sections } = buildStatementFeedback(STRONG);
        expect(sections.map((s) => s.key)).toEqual(STATEMENT_SECTION_KEYS);
    });

    it("scores a specific, measurable statement as ready", () => {
        const feedback = buildStatementFeedback(STRONG);
        expect(feedback.score).toBe(100);
        expect(feedback.sections.every((s) => s.status === "strong")).toBe(true);
        expect(feedback.summary).toMatch(/ready to finalize/i);
    });

    it("names the blank sections instead of scoring them", () => {
        const feedback = buildStatementFeedback({ ...STRONG, iBelieve: "", iWill: "   " });
        const empty = feedback.sections.filter((s) => s.status === "empty").map((s) => s.key);

        expect(empty).toEqual(["iBelieve", "iWill"]);
        expect(feedback.summary).toContain('"I BELIEVE"');
        expect(feedback.score).toBeLessThan(100);
    });

    it("flags an unmeasurable commitment only on I WILL", () => {
        const feedback = buildStatementFeedback({
            ...STRONG,
            iWill: "I will help people in my community because it matters to me.",
        });
        const iWill = feedback.sections.find((s) => s.key === "iWill");

        expect(iWill.suggestions.join(" ")).toMatch(/timeline or a number/i);
        expect(feedback.sections.find((s) => s.key === "iAm").suggestions).toEqual([]);
    });

    it("calls out hedging language", () => {
        const feedback = buildStatementFeedback({ ...STRONG, iAm: "I am maybe a good listener because I try." });
        const iAm = feedback.sections.find((s) => s.key === "iAm");
        expect(iAm.suggestions.join(" ")).toContain("maybe");
    });

    it("handles a completely empty statement without throwing", () => {
        const feedback = buildStatementFeedback({});
        expect(feedback.score).toBe(0);
        expect(feedback.summary).toMatch(/nothing to review/i);
    });
});
