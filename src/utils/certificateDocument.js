import PDFDocument from "pdfkit";

/**
 * The certificate document.
 *
 * The previous version serialized every submitted milestone response into the PDF:
 * ~12 pages of milestone ids, `viewed: true` flags, career selections and expense
 * figures handed to the participant and to anyone they forward the file to. This
 * builder takes an explicit allowlist instead — nothing reaches the page that isn't
 * one of `CERTIFICATE_FIELDS`, and `pickCertificateFields` is the only way in.
 *
 * If a new field is ever needed on the certificate, add it here deliberately; do not
 * pass a journey/profile object through.
 */
export const CERTIFICATE_FIELDS = Object.freeze([
    "issuedToName",
    "certificateId",
    "issuedAt",
    "verifyUrl",
]);

const COURSE_TITLE = "iJourney: A Path to Purpose";
const COURSE_BLURB =
    "has successfully completed the seven-milestone journey of self-discovery, emotional " +
    "intelligence, career exploration and purpose.";
const SIGNATORY = "Asha McMillan, LPC";
const SIGNATORY_ROLE = "Program Director";

const INK = "#16697A";
const ACCENT = "#FF6F61";
const MUTED = "#5C5C5C";

/**
 * Reduces an arbitrary object to exactly the fields the certificate may show.
 * @param {Record<string, unknown>} source
 */
export const pickCertificateFields = (source = {}) =>
    Object.fromEntries(CERTIFICATE_FIELDS.map((key) => [key, source[key]]));

const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

/**
 * Sizes a display name to the space available.
 *
 * Names come from the user's Firebase profile and can be arbitrarily long. Stepping
 * the size down alone is not enough — past roughly forty characters even the minimum
 * size is wider than the frame, and with wrapping disabled the name simply runs off
 * the edge of the page. So this falls back to a second line, and reports the height
 * it will occupy so everything below can be positioned from it rather than guessed.
 *
 * @returns {{ size: number, lines: number, height: number }}
 */
const fitName = (doc, text, maxWidth) => {
    const MAX_LINES = 2;
    doc.font("Times-Bold");

    for (let size = 42; size >= 20; size -= 2) {
        if (doc.fontSize(size).widthOfString(text) <= maxWidth) {
            return { size, lines: 1, height: doc.currentLineHeight() };
        }
    }

    // Too long for one line at any readable size: wrap, and shrink until it fits two.
    for (let size = 30; size >= 16; size -= 2) {
        doc.fontSize(size);
        const height = doc.heightOfString(text, { width: maxWidth, align: "center" });
        if (height <= doc.currentLineHeight() * MAX_LINES + 1) {
            return { size, lines: MAX_LINES, height };
        }
    }

    // Pathological (a single unbroken word longer than the page). Take the floor and
    // let pdfkit break it — a squeezed name still beats one printed off the page.
    doc.fontSize(16);
    return {
        size: 16,
        lines: MAX_LINES,
        height: doc.heightOfString(text, { width: maxWidth, align: "center" }),
    };
};

const drawFrame = (doc) => {
    const { width, height } = doc.page;

    doc.save();
    doc.rect(0, 0, width, height).fill("#FFFFFF");
    doc.lineWidth(3).strokeColor(INK).rect(28, 28, width - 56, height - 56).stroke();
    doc.lineWidth(1).strokeColor(ACCENT).rect(38, 38, width - 76, height - 76).stroke();

    // Corner accents, drawn inside the inner rule.
    const arm = 26;
    const corners = [
        [38, 38, 1, 1],
        [width - 38, 38, -1, 1],
        [38, height - 38, 1, -1],
        [width - 38, height - 38, -1, -1],
    ];
    doc.lineWidth(3).strokeColor(ACCENT);
    corners.forEach(([x, y, dx, dy]) => {
        doc.moveTo(x + arm * dx, y).lineTo(x, y).lineTo(x, y + arm * dy).stroke();
    });
    doc.restore();
};

/** A drawn seal — no image asset to ship, and it scales cleanly at any print size. */
const drawSeal = (doc, cx, cy) => {
    const outer = 40;

    doc.save();
    doc.circle(cx, cy, outer).lineWidth(2).strokeColor(INK).stroke();
    doc.circle(cx, cy, outer - 6).lineWidth(0.75).strokeColor(ACCENT).stroke();

    // A ring of small points where a foil seal's serration would be.
    for (let i = 0; i < 24; i += 1) {
        const angle = (i / 24) * Math.PI * 2;
        doc.circle(cx + Math.cos(angle) * (outer + 6), cy + Math.sin(angle) * (outer + 6), 1.4)
            .fillColor(ACCENT).fill();
    }

    doc.fillColor(INK).font("Times-Bold").fontSize(22)
        .text("iJ", cx - 40, cy - 16, { width: 80, align: "center", lineBreak: false });
    doc.fillColor(MUTED).font("Times-Roman").fontSize(5.5)
        .text("PATH TO PURPOSE", cx - 40, cy + 10, {
            width: 80,
            align: "center",
            characterSpacing: 0.3,
            lineBreak: false,
        });
    doc.restore();
};

/**
 * @param {{ issuedToName?: string, certificateId?: string, issuedAt?: Date|string, verifyUrl?: string }} fields
 * @param {{ compress?: boolean }} [options] `compress: false` lets tests read the text back out.
 * @returns {Promise<Buffer>}
 */
export const buildCertificatePdf = (fields, options = {}) =>
    new Promise((resolve, reject) => {
        const { issuedToName, certificateId, issuedAt, verifyUrl } = pickCertificateFields(fields);

        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margin: 0,
            compress: options.compress !== false,
            info: {
                Title: "iJourney Certificate of Completion",
                Author: "iJourney",
                Subject: COURSE_TITLE,
            },
        });

        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const { width, height } = doc.page;
        const contentWidth = width - 160;
        const left = 80;

        drawFrame(doc);

        doc.fillColor(INK).font("Times-Bold").fontSize(13)
            .text("CERTIFICATE OF COMPLETION", left, 86, {
                width: contentWidth,
                align: "center",
                characterSpacing: 4,
            });

        doc.fillColor(ACCENT).font("Times-Bold").fontSize(34)
            .text(COURSE_TITLE, left, 118, { width: contentWidth, align: "center" });

        doc.moveTo(width / 2 - 70, 168).lineTo(width / 2 + 70, 168)
            .lineWidth(1).strokeColor(ACCENT).stroke();

        doc.fillColor(MUTED).font("Times-Italic").fontSize(14)
            .text("This certifies that", left, 190, { width: contentWidth, align: "center" });

        const name = (issuedToName || "Participant").trim();
        const nameTop = 224;
        const fitted = fitName(doc, name, contentWidth);
        doc.fillColor(INK).font("Times-Bold").fontSize(fitted.size)
            .text(name, left, nameTop, {
                width: contentWidth,
                align: "center",
                // Only a name that already fits may be kept off the wrapper; forcing a
                // single line on a long one is what pushed it past the frame.
                lineBreak: fitted.lines > 1,
            });

        // Measured, not assumed, so a two-line name pushes the rule and blurb down
        // instead of being overprinted by them.
        const nameRuleY = nameTop + fitted.height + 10;
        doc.moveTo(width / 2 - 170, nameRuleY).lineTo(width / 2 + 170, nameRuleY)
            .lineWidth(0.75).strokeColor("#CCCCCC").stroke();

        const blurbTop = nameRuleY + 20;
        const blurbWidth = contentWidth - 120;
        doc.fillColor(MUTED).font("Times-Roman").fontSize(13)
            .text(COURSE_BLURB, left + 60, blurbTop, {
                width: blurbWidth,
                align: "center",
                lineGap: 3,
            });

        // Footer: signature on the left, date on the right, both on ruled lines.
        const footerY = height - 150;

        // The seal sits in whatever gap is left between the blurb and the footer rules,
        // rather than at a fixed y that a two-line name would collide with.
        const blurbBottom = blurbTop + doc.heightOfString(COURSE_BLURB, {
            width: blurbWidth,
            align: "center",
            lineGap: 3,
        });
        const SEAL_RADIUS = 46;
        const sealY = Math.min(
            Math.max(blurbBottom + SEAL_RADIUS + 6, 378),
            footerY - SEAL_RADIUS - 12
        );
        drawSeal(doc, width / 2, sealY);
        const blockWidth = 200;
        const rightX = width - 80 - blockWidth;

        doc.lineWidth(0.75).strokeColor("#999999");
        doc.moveTo(left, footerY).lineTo(left + blockWidth, footerY).stroke();
        doc.moveTo(rightX, footerY).lineTo(rightX + blockWidth, footerY).stroke();

        doc.fillColor(INK).font("Times-Bold").fontSize(12)
            .text(SIGNATORY, left, footerY + 8, { width: blockWidth, align: "center" });
        doc.fillColor(MUTED).font("Times-Roman").fontSize(10)
            .text(SIGNATORY_ROLE, left, footerY + 24, { width: blockWidth, align: "center" });

        doc.fillColor(INK).font("Times-Bold").fontSize(12)
            .text(formatDate(issuedAt), rightX, footerY + 8, { width: blockWidth, align: "center" });
        doc.fillColor(MUTED).font("Times-Roman").fontSize(10)
            .text("Date of completion", rightX, footerY + 24, { width: blockWidth, align: "center" });

        doc.fillColor(MUTED).font("Times-Roman").fontSize(9)
            .text(`Certificate ID ${certificateId || ""}`, left, height - 78, {
                width: contentWidth,
                align: "center",
            });

        if (verifyUrl) {
            doc.fillColor(INK).fontSize(9)
                .text(`Verify at ${verifyUrl}`, left, height - 65, {
                    width: contentWidth,
                    align: "center",
                    link: verifyUrl,
                });
        }

        doc.end();
    });
