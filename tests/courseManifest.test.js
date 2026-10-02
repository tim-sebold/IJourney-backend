import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
    COMPLETED_KEY,
    MILESTONE_ORDER,
    REQUIRED_RESPONSE_KEYS,
    START_KEY,
    isImmediateSuccessor,
    requiresResponse,
    toResponseKey,
} from "../src/config/courseManifest.js";

describe("course manifest", () => {
    it("has no duplicate keys", () => {
        expect(new Set(MILESTONE_ORDER).size).toBe(MILESTONE_ORDER.length);
    });

    it("is one unbroken chain from start to completed", () => {
        expect(isImmediateSuccessor(START_KEY, MILESTONE_ORDER[0])).toBe(true);
        for (let i = 1; i < MILESTONE_ORDER.length; i += 1) {
            expect(isImmediateSuccessor(MILESTONE_ORDER[i - 1], MILESTONE_ORDER[i])).toBe(true);
        }
        expect(isImmediateSuccessor(MILESTONE_ORDER.at(-1), COMPLETED_KEY)).toBe(true);
    });

    it("refuses to skip a step or jump to the end", () => {
        expect(isImmediateSuccessor(START_KEY, MILESTONE_ORDER.at(-1))).toBe(false);
        expect(isImmediateSuccessor(MILESTONE_ORDER[0], MILESTONE_ORDER[2])).toBe(false);
        expect(isImmediateSuccessor(MILESTONE_ORDER[0], COMPLETED_KEY)).toBe(false);
    });
});

/**
 * The manifest lives here; the pages, routes and sidebar live in the frontend
 * repository. Nothing else fails when they drift, and they have: on 2026-09-06
 * the frontend deleted M2.11 and M2.12 while the manifest kept them, which left
 * M2.10's Next rejected by the unlock gate and the certificate demanding a
 * response for a page that no longer existed.
 *
 * The frontend is a sibling checkout in development. Where it is absent (a
 * backend-only CI job), these are skipped rather than failed.
 */
const FRONTEND_SRC = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../IJourney-frontend/src"
);
const describeWithFrontend = existsSync(FRONTEND_SRC) ? describe : describe.skip;

/** Progress-form key -> source of the page that renders it. */
const readFrontendPages = () => {
    const pages = new Map();

    const milestonesDir = path.join(FRONTEND_SRC, "components/Milestones");
    for (const group of readdirSync(milestonesDir)) {
        const groupMatch = group.match(/^Milestone(\d+)$/);
        if (!groupMatch) continue;
        for (const file of readdirSync(path.join(milestonesDir, group))) {
            const fileMatch = file.match(/^Milestone(\d+)\.tsx$/);
            if (!fileMatch) continue;
            pages.set(
                `milestone${groupMatch[1]}/${fileMatch[1]}`,
                readFileSync(path.join(milestonesDir, group, file), "utf8")
            );
        }
    }

    // The two Introduction pages are routed by hand in App.tsx.
    const app = readFileSync(path.join(FRONTEND_SRC, "App.tsx"), "utf8");
    const introDir = path.join(FRONTEND_SRC, "pages/Milestone/Introduction");
    for (const [, key, component] of app.matchAll(/path:\s*"(milestone0\/\d+)",\s*element:\s*<(\w+)/g)) {
        pages.set(key, readFileSync(path.join(introDir, `${component}.tsx`), "utf8"));
    }

    return pages;
};

const byCourseOrder = (a, b) => {
    const [ga, ca] = a.match(/\d+/g).map(Number);
    const [gb, cb] = b.match(/\d+/g).map(Number);
    return ga - gb || ca - cb;
};

describeWithFrontend("manifest agrees with the frontend", () => {
    const pages = readFrontendPages();

    it("has a page for every milestone, and a milestone for every page", () => {
        expect([...pages.keys()].sort(byCourseOrder)).toEqual(MILESTONE_ORDER);
    });

    it("lists every milestone after the introduction in the sidebar, in order", () => {
        const layoutData = readFileSync(path.join(FRONTEND_SRC, "datas/layoutData.ts"), "utf8");
        const sidebar = layoutData.slice(layoutData.indexOf("sidebarData"));
        const urls = [...sidebar.matchAll(/url:\s*"\/milestones\/(milestone\d+\/\d+)"/g)].map(([, key]) => key);

        expect(urls).toEqual(MILESTONE_ORDER.filter((key) => !key.startsWith("milestone0/")));
    });

    it.each(MILESTONE_ORDER)("%s unlocks the step that follows it", (key) => {
        const source = pages.get(key) ?? "";
        const unlocks = [...source.matchAll(
            /milestoneId:\s*["']([^"']+)["'],\s*prevMilestoneId:\s*["']([^"']+)["']/g
        )].map(([, milestoneId, prevMilestoneId]) => ({ milestoneId, prevMilestoneId }));

        expect(unlocks.length).toBeGreaterThan(0);
        for (const unlock of unlocks) {
            expect(unlock.prevMilestoneId).toBe(key);
            expect(isImmediateSuccessor(key, unlock.milestoneId)).toBe(true);
        }
    });

    it.each(REQUIRED_RESPONSE_KEYS)("%s submits the response the gates look for", (key) => {
        const responseKey = toResponseKey(key);
        const source = pages.get(key) ?? "";
        const submits =
            source.includes(`submitMilestone('${responseKey}'`) ||
            source.includes(`submitMilestone("${responseKey}"`) ||
            source.includes(`milestoneKey: "${responseKey}"`) ||
            source.includes(`milestoneKey: '${responseKey}'`);

        expect(submits).toBe(true);
    });

    it("has no page submitting to a milestone that collects nothing", () => {
        const offenders = [];
        for (const [key, source] of pages) {
            for (const [, responseKey] of source.matchAll(
                /(?:submitMilestone\(|milestoneKey:\s*)["'](milestone\d+_\d+)["']/g
            )) {
                if (!requiresResponse(responseKey.replace("_", "/"))) {
                    offenders.push(`${key} -> ${responseKey}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
