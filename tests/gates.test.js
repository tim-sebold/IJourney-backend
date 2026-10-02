import { jest } from "@jest/globals";
import request from "supertest";
import { createFakeFirebase } from "./helpers/fakeFirebase.js";

const fake = createFakeFirebase();

jest.unstable_mockModule("../src/config/firebaseAdmin.js", () => ({
    admin: fake.admin,
    db: fake.db,
}));

const { default: app } = await import("../src/app.js");
const { MILESTONE_ORDER, REQUIRED_RESPONSE_KEYS, requiresResponse, toResponseKey } =
    await import("../src/config/courseManifest.js");

const as = (token) => ({ Authorization: `Bearer ${token}` });

const submit = (uid, key) =>
    request(app)
        .post(`/api/courses/${toResponseKey(key)}/submit`)
        .set(as(uid))
        .send({ responses: { answer: "my answer" } });

const unlock = (uid, prevMilestoneId, milestoneId) =>
    request(app)
        .post("/api/courses/unlock")
        .set(as(uid))
        .send({ prevMilestoneId, milestoneId });

/** Walks the whole course the way the pages do: submit where required, then unlock. */
const completeCourse = async (uid, { skip = [] } = {}) => {
    await unlock(uid, "start", MILESTONE_ORDER[0]);
    for (let i = 0; i < MILESTONE_ORDER.length; i += 1) {
        const key = MILESTONE_ORDER[i];
        if (requiresResponse(key) && !skip.includes(key)) await submit(uid, key);
        await unlock(uid, key, MILESTONE_ORDER[i + 1] ?? "completed");
    }
};

beforeEach(() => fake.reset());

describe("unlock gate", () => {
    it("rejects a request with no token", async () => {
        const res = await request(app)
            .post("/api/courses/unlock")
            .send({ prevMilestoneId: "start", milestoneId: MILESTONE_ORDER[0] });
        expect(res.status).toBe(401);
    });

    it("refuses to jump across the course", async () => {
        const res = await unlock("u1", "start", MILESTONE_ORDER.at(-1));
        expect(res.status).toBe(400);
        expect(fake.read("progress/u1")).toBeUndefined();
    });

    it("refuses to leave a response-collecting step that was not submitted", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        const next = MILESTONE_ORDER[MILESTONE_ORDER.indexOf(key) + 1];

        const res = await unlock("u1", key, next);

        expect(res.status).toBe(409);
        expect(fake.read("progress/u1")).toBeUndefined();
    });

    it("does not count a draft as submitted", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        const next = MILESTONE_ORDER[MILESTONE_ORDER.indexOf(key) + 1];

        await request(app)
            .post(`/api/courses/${toResponseKey(key)}/draft`)
            .set(as("u1"))
            .send({ responses: { answer: "half" } });

        expect((await unlock("u1", key, next)).status).toBe(409);
    });

    it("completes the step and unlocks the next once the response is in", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        const next = MILESTONE_ORDER[MILESTONE_ORDER.indexOf(key) + 1];

        expect((await submit("u1", key)).status).toBe(201);
        expect((await unlock("u1", key, next)).status).toBe(200);

        const progress = fake.read("progress/u1");
        expect(progress[key].completed).toBe(true);
        expect(progress[next].unlocked).toBe(true);
    });

    it("keeps a submitted response submitted when a later autosave arrives", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        await submit("u1", key);

        await request(app)
            .post(`/api/courses/${toResponseKey(key)}/draft`)
            .set(as("u1"))
            .send({ responses: { answer: "edited" } });

        expect(fake.read(`responses/u1/milestones/${toResponseKey(key)}`).status).toBe("submitted");
    });

    it("will not store a response for a page that collects none", async () => {
        const contentOnly = MILESTONE_ORDER.find((key) => !requiresResponse(key));
        expect((await submit("u1", contentOnly)).status).toBe(400);
    });

    it("writes only to the caller's own documents, whatever the body claims", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        await request(app)
            .post(`/api/courses/${toResponseKey(key)}/submit`)
            .set(as("u1"))
            .send({ userId: "victim", responses: { answer: "x" } });

        expect(fake.read(`responses/victim/milestones/${toResponseKey(key)}`)).toBeUndefined();
        expect(fake.read(`responses/u1/milestones/${toResponseKey(key)}`)).toBeDefined();
    });
});

describe("certificate gate", () => {
    jest.setTimeout(30000);

    const download = (uid) => request(app).post("/api/certificates/download").set(as(uid));

    it("issues a certificate to a user who walked the whole course", async () => {
        fake.seed("users/u1", { displayName: "Jordan Rivera" });
        await completeCourse("u1");

        const res = await download("u1");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("application/pdf");
        expect(fake.read("progress/u1").certificate.issuedToName).toBe("Jordan Rivera");
    });

    it("every milestone ends up completed, so progress reads 100%", async () => {
        await completeCourse("u1");

        const res = await request(app).get("/api/user/progress").set(as("u1"));

        expect(res.body.summary.completed).toBe(MILESTONE_ORDER.length);
        expect(res.body.summary.percent).toBe(100);
    });

    // The 8.1 case: a content revision made a page start collecting work after
    // this user had already walked through it. They reached the certificate page
    // legitimately and must be told which step to go back to — not just refused.
    it("names the outstanding steps when a required response is missing", async () => {
        const [first, , third] = REQUIRED_RESPONSE_KEYS;
        await completeCourse("u1", { skip: [first, third] });
        // Skipped steps block the chain, so place the user on the certificate page
        // the way pre-revision progress would have.
        fake.seed("progress/u1", { "milestone7/4": { unlocked: true } });

        const res = await download("u1");

        expect(res.status).toBe(409);
        expect(res.body.outstanding).toEqual(expect.arrayContaining([first, third]));
        expect(res.body.error).toMatch(/still need/);
        expect(fake.read("progress/u1").certificate).toBeUndefined();
    });

    it("treats a draft on a required step as outstanding", async () => {
        const key = REQUIRED_RESPONSE_KEYS[0];
        for (const required of REQUIRED_RESPONSE_KEYS) {
            fake.seed(`responses/u1/milestones/${toResponseKey(required)}`, {
                responses: { answer: "x" },
                status: required === key ? "draft" : "submitted",
            });
        }
        fake.seed("progress/u1", { "milestone7/4": { unlocked: true } });

        const res = await download("u1");

        expect(res.status).toBe(409);
        expect(res.body.outstanding).toEqual([key]);
    });

    it("refuses a user with every response but who never reached the certificate page", async () => {
        for (const required of REQUIRED_RESPONSE_KEYS) {
            fake.seed(`responses/u1/milestones/${toResponseKey(required)}`, {
                responses: { answer: "x" },
                status: "submitted",
            });
        }

        expect((await download("u1")).status).toBe(400);
    });
});

describe("school codes", () => {
    const register = (body) =>
        request(app).post("/api/auth/register").send({
            name: "Sam Student",
            email: `sam${Math.random().toString(36).slice(2)}@example.org`,
            password: "correct-horse",
            ...body,
        });

    const admin = as("boss:admin");

    it("is closed to non-admins", async () => {
        expect((await request(app).get("/api/admin/schools").set(as("u1"))).status).toBe(403);
        expect((await request(app).post("/api/admin/schools").set(as("u1"))
            .send({ schoolName: "West Middle School" })).status).toBe(403);
    });

    it("creates a school with a generated code that avoids look-alike characters", async () => {
        const res = await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "  West   Middle School " });

        expect(res.status).toBe(201);
        expect(res.body.school.schoolName).toBe("West Middle School");
        expect(res.body.school.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    });

    it("refuses a code that is already taken rather than overwriting the school", async () => {
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "West Middle School", code: "WESTMS" });
        const res = await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "Another School", code: "west-ms" });

        expect(res.status).toBe(409);
        expect(fake.read("schools/WESTMS").schoolName).toBe("West Middle School");
    });

    it("registers without a code", async () => {
        const res = await register({});
        expect(res.status).toBe(201);
        expect(fake.read(`users/${res.body.uid}`).schoolCode).toBeUndefined();
    });

    it("stamps the school on the account, however the code was typed", async () => {
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "West Middle School", code: "WESTMS" });

        const res = await register({ schoolCode: " west-ms " });

        expect(res.status).toBe(201);
        expect(fake.read(`users/${res.body.uid}`).schoolCode).toBe("WESTMS");
    });

    it("rejects an unknown code before creating any account", async () => {
        const res = await register({ schoolCode: "NOPE99" });

        expect(res.status).toBe(400);
        expect(fake.authUsers.size).toBe(0);
    });

    it("rejects a deactivated code", async () => {
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "West Middle School", code: "WESTMS" });
        await request(app).patch("/api/admin/schools/WESTMS").set(admin).send({ active: false });

        expect((await register({ schoolCode: "WESTMS" })).status).toBe(400);
    });

    it("ignores a role or school smuggled into the registration body", async () => {
        const res = await register({ role: "admin" });
        expect(fake.read(`users/${res.body.uid}`).role).toBe("user");
    });

    it("counts signups per school and reports accounts with no code", async () => {
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "West Middle School", code: "WESTMS" });
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "East High", code: "EASTHS" });
        await register({ schoolCode: "WESTMS" });
        await register({ schoolCode: "WESTMS" });
        await register({});

        const res = await request(app).get("/api/admin/schools").set(admin);

        expect(res.status).toBe(200);
        expect(res.body.totalUsers).toBe(3);
        expect(res.body.unassigned).toBe(1);
        expect(res.body.schools.map(({ code, signups }) => [code, signups]))
            .toEqual([["EASTHS", 0], ["WESTMS", 2]]);
    });

    it("renames a school without touching its code or its count", async () => {
        await request(app).post("/api/admin/schools").set(admin)
            .send({ schoolName: "West Middle", code: "WESTMS" });
        await register({ schoolCode: "WESTMS" });

        const res = await request(app).patch("/api/admin/schools/westms").set(admin)
            .send({ schoolName: "West Middle School" });

        expect(res.status).toBe(200);
        const list = await request(app).get("/api/admin/schools").set(admin);
        expect(list.body.schools).toEqual([
            expect.objectContaining({ code: "WESTMS", schoolName: "West Middle School", signups: 1 }),
        ]);
    });
});

describe("profile update", () => {
    const put = (body) => request(app).put("/api/user/profile").set(as("u1")).send(body);

    it("saves the fields a user may change", async () => {
        fake.seed("users/u1", { role: "user", name: "Old" });

        expect((await put({ name: " New Name ", gender: "female" })).status).toBe(200);
        expect(fake.read("users/u1")).toMatchObject({ name: "New Name", gender: "female", role: "user" });
    });

    it("never writes role or schoolCode", async () => {
        fake.seed("users/u1", { role: "user" });

        await put({ name: "New Name", role: "admin", schoolCode: "WESTMS" });

        const saved = fake.read("users/u1");
        expect(saved.role).toBe("user");
        expect(saved.schoolCode).toBeUndefined();
    });

    it("answers 400, not 500, when only unknown fields are sent", async () => {
        expect((await put({ role: "admin" })).status).toBe(400);
    });
});
