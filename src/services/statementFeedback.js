/**
 * Feedback on a Journeyer's Statement (M6.4).
 *
 * The page has always promised "our AI chatbot will provide constructive feedback",
 * but no model provider is configured for this project and the button was wired to an
 * empty function. Rather than ship a button that still does nothing, this generates the
 * feedback deterministically from the text itself: length, specificity, concrete detail,
 * and — for `I WILL` — whether the commitment is measurable.
 *
 * It runs server-side so the rubric is one thing to change when a real model is wired
 * in: swap the body of `buildStatementFeedback` and the route/UI stay as they are.
 */

const SECTIONS = [
    {
        key: 'iAm',
        label: 'I AM',
        prompt: 'your identity and values',
        minWords: 8,
    },
    {
        key: 'iBelieve',
        label: 'I BELIEVE',
        prompt: 'the convictions you want to act from',
        minWords: 8,
    },
    {
        key: 'iWill',
        label: 'I WILL',
        prompt: 'the action you are committing to',
        minWords: 8,
        wantsMeasurable: true,
    },
    {
        key: 'iAmConfident',
        label: 'I AM CONFIDENT',
        prompt: 'what you already know you can do',
        minWords: 6,
    },
    {
        key: 'iAmCapable',
        label: 'I AM CAPABLE',
        prompt: 'the capability you are growing into',
        minWords: 6,
    },
];

export const STATEMENT_SECTION_KEYS = SECTIONS.map((s) => s.key);

/** Hedges that weaken a commitment. */
const HEDGES = ['maybe', 'hopefully', 'kind of', 'sort of', 'try to', 'i guess', 'probably', 'someday'];

/**
 * Signals that a sentence explains itself rather than just asserting a virtue.
 * Deliberately limited to connectives that introduce a reason or a method —
 * bare prepositions like "for" or "at" appear in almost every sentence and would
 * make this nudge fire at random.
 */
const SPECIFIC_MARKERS = /\b(because|so that|in order to|through|by \w+ing|whenever|when i)\b/i;

/**
 * Signals that a commitment can be checked off. Quantities are written out as often
 * as they are typed as digits ("two students each semester"), so word-numbers and
 * period nouns count just as much as `\d+`.
 */
const MEASURABLE_MARKERS = new RegExp(
    [
        '\\d+',
        '\\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\\b',
        '\\b(once|twice)\\b',
        '\\b(every|each|per)\\b',
        '\\b(daily|weekly|monthly|quarterly|yearly|annually)\\b',
        '\\b(day|week|month|year|semester|term|quarter|summer|morning|evening)s?\\b',
        '\\b(within|before|after|until|by the end of)\\b',
    ].join('|'),
    'i'
);

const words = (text) => text.trim().split(/\s+/).filter(Boolean);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function reviewSection(section, text) {
    /** Things that have to change before the section reads as finished. */
    const blocking = [];
    /** Worth trying, but the section is not wrong without it. */
    const optional = [];
    const wordCount = words(text).length;

    if (!text) {
        return {
            key: section.key,
            label: section.label,
            status: 'empty',
            wordCount: 0,
            suggestions: [`"${section.label}..." is still blank. Write a sentence about ${section.prompt}.`],
            optional: [],
        };
    }

    if (wordCount < section.minWords) {
        blocking.push(
            `This is only ${wordCount} ${wordCount === 1 ? 'word' : 'words'}. Aim for at least ` +
            `${section.minWords} so a reader can tell what you actually mean.`
        );
    }

    const hedge = HEDGES.find((h) => text.toLowerCase().includes(h));
    if (hedge) {
        blocking.push(`"${hedge}" softens this. Say it as something you are, not something you might be.`);
    }

    if (section.wantsMeasurable && !MEASURABLE_MARKERS.test(text)) {
        blocking.push(
            'Give this a timeline or a number — "by June 2027", "every week", "three schools" — so you can tell when you have done it.'
        );
    }

    if (!/[.!?]$/.test(text)) {
        blocking.push('Finish the sentence with punctuation so the statement reads as a declaration.');
    }

    // A statement can be perfectly good without spelling out its reasoning, so this
    // is an invitation rather than a fault — it never holds a section back.
    if (!SPECIFIC_MARKERS.test(text)) {
        optional.push(
            'Add the "why" or the "how" — "because", "so that" or "by doing X" turns a label into evidence.'
        );
    }

    // Kept in two lists, not one: the UI marks a strong section with a green tick, and
    // a lone "optional" bullet underneath it read as an unresolved fault when the two
    // were concatenated.
    return {
        key: section.key,
        label: section.label,
        status: blocking.length === 0 ? 'strong' : 'needs-work',
        wordCount,
        suggestions: blocking,
        optional,
    };
}

/**
 * @param {Record<string, unknown>} statement the five-section Journeyer's Statement
 * @returns {{ score: number, summary: string, strengths: string[], sections: object[] }}
 */
export function buildStatementFeedback(statement = {}) {
    const sections = SECTIONS.map((section) => reviewSection(section, clean(statement[section.key])));

    const strong = sections.filter((s) => s.status === 'strong');
    const empty = sections.filter((s) => s.status === 'empty');
    const score = Math.round((strong.length / SECTIONS.length) * 100);

    const strengths = strong.map((s) => `"${s.label}" reads as finished — nothing is holding it back.`);

    let summary;
    if (empty.length === SECTIONS.length) {
        summary = 'There is nothing to review yet. Go back to M6.3 and draft all five sections first.';
    } else if (empty.length) {
        summary =
            `${SECTIONS.length - empty.length} of ${SECTIONS.length} sections are drafted. ` +
            `Fill in ${empty.map((s) => `"${s.label}"`).join(', ')} and run this again.`;
    } else if (strong.length === SECTIONS.length) {
        summary = 'All five sections are specific, committed and measurable. This is ready to finalize.';
    } else if (strong.length === 0) {
        // "0 of 5 sections are already strong" is a discouraging thing to tell a
        // teenager about their own vision statement. Same information, forward-looking.
        summary =
            'All five sections are written — now they need sharpening. Work through the notes ' +
            'below and run this again; each one is a small edit, not a rewrite.';
    } else {
        summary =
            `${strong.length} of ${SECTIONS.length} sections are already strong. ` +
            'The notes below are the smallest changes that would lift the rest.';
    }

    return { score, summary, strengths, sections };
}
