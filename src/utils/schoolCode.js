import { randomInt } from 'node:crypto';

/**
 * School codes are read off a handout and typed by students, so the alphabet
 * leaves out every glyph that is easy to misread: 0/O, 1/I/L.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const GENERATED_CODE_LENGTH = 6;

/** Admin-chosen codes may be friendlier (`WESTMS`), within these bounds. */
const CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

/**
 * Case-folds and strips spaces and dashes, so `west-ms 24` and `WESTMS24` are
 * the same code. Returns '' for anything that is not a string.
 */
export const normalizeSchoolCode = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase().replace(/[\s-]+/g, '');
};

export const isValidSchoolCode = (code) => CODE_PATTERN.test(code);

export const generateSchoolCode = () => {
    let code = '';
    for (let i = 0; i < GENERATED_CODE_LENGTH; i += 1) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
};
