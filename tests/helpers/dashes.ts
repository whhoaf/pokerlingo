// Built from character codes so this file does not contain the characters it hunts for.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

/** Matches an em dash or an en dash. The writing rules ban both. */
export const DASHES = new RegExp(`[${EN}${EM}]`);
