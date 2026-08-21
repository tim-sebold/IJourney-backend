import { jest } from "@jest/globals";
import {
    CERTIFICATE_FIELDS,
    buildCertificatePdf,
    pickCertificateFields,
} from "../src/utils/certificateDocument.js";

jest.setTimeout(20000);

/**
 * The exact shapes the 2026-08-19 client video showed leaking into the generated PDF:
 * milestone ids, `viewed` flags, serialized character strengths, career selections and
 * expense figures. If any of it can reach the document again, this fails.
 */
const LEAKED_JOURNEY_DATA = {
    milestone2_11: { answers: { Honesty: ":)", Bravery: ":)", Humor: ":)" }, viewed: true },
    milestone2_13: { viewed: true },
    milestone3_1: { viewed: true },
    milestone3_4: { monthlyExpenses: 2450, monthlySavings: 375 },
    selectedCharacterStrengths: [
        { title: "Appreciation or beauty & Excellence", content: ["Feels awe and wonder in nature"] },
        { title: "Bravery", content: ["Shows valor", "Accepts challenges"] },
    ],
    selectedCareers: ["counselor", "missionary", "motivational speaker"],
    status: "submitted",
};

const FIELDS = {
    issuedToName: "Jordan Rivera",
    certificateId: "IJ-2026-482913",
    issuedAt: new Date("2026-08-19T12:00:00Z"),
    verifyUrl: "https://www.i-journey.org/verify/IJ-2026-482913",
};

/**
 * Pulls the visible text back out of an uncompressed PDF. pdfkit writes standard-font
 * runs as `[<hex> kern <hex>] TJ`, so decoding the hex operands gives the words as the
 * reader sees them — which is what an assertion about leaked data has to look at, not
 * the raw bytes (xref offsets contain arbitrary digit strings).
 */
const extractText = (pdf) => {
    const raw = pdf.toString("latin1");
    const runs = [];

    for (const match of raw.matchAll(/\[((?:\s*<[0-9a-fA-F]*>\s*-?[\d.]*)+)\]\s*TJ/g)) {
        const run = [...match[1].matchAll(/<([0-9a-fA-F]*)>/g)]
            .map(([, hex]) => Buffer.from(hex, "hex").toString("latin1"))
            .join("");
        runs.push(run);
    }

    return runs.join("\n");
};

const renderText = async (fields) => extractText(await buildCertificatePdf(fields, { compress: false }));

describe("pickCertificateFields", () => {
    it("keeps only the allowlisted fields", () => {
        const picked = pickCertificateFields({ ...FIELDS, ...LEAKED_JOURNEY_DATA });
        expect(Object.keys(picked).sort()).toEqual([...CERTIFICATE_FIELDS].sort());
    });

    it("drops journey data even when it is passed in", () => {
        const picked = pickCertificateFields({ ...FIELDS, ...LEAKED_JOURNEY_DATA });
        expect(picked.selectedCareers).toBeUndefined();
        expect(picked.milestone3_4).toBeUndefined();
        expect(picked.status).toBeUndefined();
    });
});

describe("buildCertificatePdf", () => {
    it("renders the participant, id and verification url", async () => {
        const text = await renderText(FIELDS);

        expect(text).toContain("Jordan Rivera");
        expect(text).toContain("IJ-2026-482913");
        expect(text).toContain("CERTIFICATE OF COMPLETION");
        expect(text).toContain("iJourney: A Path to Purpose");
        expect(text).toContain("August 19, 2026");
    });

    it("is a single page", async () => {
        const pdf = await buildCertificatePdf(FIELDS, { compress: false });
        const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
        expect(pageCount).toBe(1);
    });

    it("leaks no journey data when the whole journey object is handed to it", async () => {
        const text = await renderText({ ...FIELDS, ...LEAKED_JOURNEY_DATA });

        const forbidden = [
            "viewed",
            "selectedCharacterStrengths",
            "counselor",
            "missionary",
            "motivational speaker",
            "monthlyExpenses",
            "monthlySavings",
            "submitted",
            "Appreciation or beauty",
            "2450",
            "375",
        ];

        for (const needle of forbidden) {
            expect(text).not.toContain(needle);
        }
    });

    it("leaks no internal milestone identifiers", async () => {
        const text = await renderText({ ...FIELDS, ...LEAKED_JOURNEY_DATA });
        // "seven-milestone journey" is deliberate prose; `milestone2_11` is not.
        expect(text).not.toMatch(/milestone\s*\d/i);
    });

    it("falls back to a neutral name rather than an empty certificate", async () => {
        const text = await renderText({ ...FIELDS, issuedToName: "" });
        expect(text).toContain("Participant");
    });
});
