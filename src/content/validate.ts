// Checks for the two content files. Each validator returns a list of problems; an empty list means the file is good.
// The same checks run in the tests, so a bad content file fails the build.

import { parseRange } from '../engine/ranges';
import { MAX_PLAYERS, MIN_PLAYERS, isSeatName } from '../engine/seats';
import { lookupFor, spotShapes } from './chart';
import { fractionsInside } from './sizing';
import {
  RULE_IDS,
  RULE_UNITS,
  SITUATION_IDS,
  TBD_SOURCE,
  isAction,
  type Action,
  type HouseChart,
  type SizingRules,
  type Situation,
} from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Problems with the top of a file: version, draft flag and the source list. Returns the known source IDs. */
function checkTop(file: unknown, errors: string[]): { obj: Obj; sourceIds: Set<string>; draft: boolean } | null {
  if (!isObj(file)) {
    errors.push('The file must be a JSON object.');
    return null;
  }
  if (file.version !== 1) errors.push('"version" must be 1.');
  if (typeof file.draft !== 'boolean') errors.push('"draft" must be true or false.');
  const draft = file.draft === true;

  const sourceIds = new Set<string>();
  if (!isObj(file.sources)) {
    errors.push('"sources" must be an object of source IDs.');
  } else {
    for (const [id, s] of Object.entries(file.sources)) {
      sourceIds.add(id);
      if (!isObj(s) || typeof s.title !== 'string' || typeof s.site !== 'string' || typeof s.url !== 'string') {
        errors.push(`Source ${id} needs a title, a site and a url, all text.`);
        continue;
      }
      if (id === TBD_SOURCE) {
        if (!draft) errors.push(`Source ${TBD_SOURCE} is a placeholder and is only allowed while "draft" is true.`);
        continue;
      }
      if (!isText(s.title)) errors.push(`Source ${id} has no title.`);
      if (!/^https?:\/\/\S+$/.test(s.url)) errors.push(`Source ${id} needs a web address (http or https) in "url".`);
    }
  }
  return { obj: file, sourceIds, draft };
}

/** Every item cites at least one source, every cited source exists, and TBD is only cited in a draft. */
function checkCites(where: string, cites: unknown, sourceIds: Set<string>, draft: boolean, errors: string[]): void {
  if (!Array.isArray(cites) || cites.length === 0 || !cites.every(isText)) {
    errors.push(`${where}: "sources" must list at least one source ID.`);
    return;
  }
  for (const id of cites as string[]) {
    if (!sourceIds.has(id)) errors.push(`${where}: cites source ${id}, which is not in "sources".`);
    else if (id === TBD_SOURCE && !draft) errors.push(`${where}: cites ${TBD_SOURCE}, which is only allowed while "draft" is true.`);
  }
}

function checkSpan(where: string, span: unknown, errors: string[]): void {
  if (!isObj(span) || !isNum(span.min) || !isNum(span.max)) {
    errors.push(`${where}: needs a "min" and a "max", both numbers.`);
    return;
  }
  if (span.min <= 0 || span.max <= 0) errors.push(`${where}: numbers must be positive.`);
  if (span.min > span.max) errors.push(`${where}: "min" must be at most "max".`);
}

function checkRange(where: string, text: unknown, errors: string[]): Set<string> | null {
  if (typeof text !== 'string') {
    errors.push(`${where}: a range must be text.`);
    return null;
  }
  try {
    return parseRange(text);
  } catch (e) {
    errors.push(`${where}: ${(e as Error).message}`);
    return null;
  }
}

function checkSeatList(where: string, seats: unknown, errors: string[]): void {
  if (!Array.isArray(seats) || seats.length === 0 || !seats.every((s) => typeof s === 'string' && isSeatName(s))) {
    errors.push(`${where}: must be a list of seat names (UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB).`);
  }
}

function checkSituation(id: string, s: unknown, sourceIds: Set<string>, draft: boolean, errors: string[]): void {
  const where = `Situation ${id}`;
  if (!isObj(s)) {
    errors.push(`${where}: must be an object.`);
    return;
  }
  if (!isText(s.title)) errors.push(`${where}: needs a title.`);
  if (!isText(s.reason)) errors.push(`${where}: needs a one-line reason.`);
  checkCites(where, s.sources, sourceIds, draft, errors);
  checkSeatList(`${where}: "seats"`, s.seats, errors);

  const players = s.players;
  if (
    !Array.isArray(players) ||
    players.length !== 2 ||
    !players.every((n) => Number.isInteger(n) && n >= MIN_PLAYERS && n <= MAX_PLAYERS) ||
    (players[0] as number) > (players[1] as number)
  ) {
    errors.push(`${where}: "players" must be [smallest, largest] between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`);
  }
  if (s.limpers !== undefined) {
    const l = s.limpers;
    if (!Array.isArray(l) || l.length !== 2 || !l.every((n) => Number.isInteger(n) && n > 0) || (l[0] as number) > (l[1] as number)) {
      errors.push(`${where}: "limpers" must be [fewest, most], whole numbers above zero.`);
    }
  }
  if (s.raiser !== undefined) checkSeatList(`${where}: "raiser"`, s.raiser, errors);

  const choices = s.choices;
  if (!Array.isArray(choices) || choices.length < 2 || !choices.every(isAction) || new Set(choices).size !== choices.length) {
    errors.push(`${where}: "choices" must list at least two different actions (raise, call, check, reraise, fold).`);
    return;
  }
  const allowed = new Set<string>(choices as string[]);
  if (!isAction(s.default) || !allowed.has(s.default)) errors.push(`${where}: "default" must be one of the choices.`);

  if (!isObj(s.ranges)) {
    errors.push(`${where}: "ranges" must be an object with one range per action.`);
    return;
  }
  const buckets = new Map<string, Set<string>>();
  for (const [action, text] of Object.entries(s.ranges)) {
    if (!allowed.has(action)) {
      errors.push(`${where}: "ranges" has ${action}, which is not one of the choices.`);
      continue;
    }
    const set = checkRange(`${where}, ${action} range`, text, errors);
    if (set) buckets.set(action, set);
  }

  const eitherSets: { hands: Set<string>; accept: Action[] }[] = [];
  if (s.either !== undefined) {
    if (!Array.isArray(s.either)) {
      errors.push(`${where}: "either" must be a list.`);
    } else {
      s.either.forEach((e: unknown, i: number) => {
        const w = `${where}, either entry ${i + 1}`;
        if (!isObj(e)) {
          errors.push(`${w}: must be an object with "hands" and "accept".`);
          return;
        }
        const hands = checkRange(`${w}`, e.hands, errors);
        const accept = e.accept;
        if (
          !Array.isArray(accept) ||
          !accept.every((a) => isAction(a) && allowed.has(a)) ||
          new Set(accept).size < 2
        ) {
          errors.push(`${w}: "accept" must list at least two different actions from this situation's choices.`);
        } else if (hands) {
          eitherSets.push({ hands, accept: accept as Action[] });
        }
      });
    }
  }

  // No hand in two action buckets, unless an either entry decides it. No hand in two either entries.
  const claimed = new Map<string, string>();
  for (const [action, set] of buckets) {
    for (const hand of set) {
      const other = claimed.get(hand);
      if (other !== undefined && other !== action && !eitherSets.some((e) => e.hands.has(hand))) {
        errors.push(`${where}: ${hand} is in both the ${other} and ${action} ranges. List it under "either" or remove one.`);
      }
      claimed.set(hand, action);
    }
  }
  const inEither = new Set<string>();
  for (const e of eitherSets) {
    for (const hand of e.hands) {
      if (inEither.has(hand)) errors.push(`${where}: ${hand} is in more than one "either" entry.`);
      inEither.add(hand);
    }
  }
}

/** Problems in a house chart. An empty list means the chart is good. */
export function validateHouseChart(file: unknown): string[] {
  const errors: string[] = [];
  const top = checkTop(file, errors);
  if (!top) return errors;
  const { obj, sourceIds, draft } = top;

  if (!isObj(obj.situations)) {
    errors.push('"situations" must be an object.');
    return errors;
  }
  for (const id of SITUATION_IDS) {
    if (!(id in obj.situations)) errors.push(`Situation ${id} is missing.`);
  }
  for (const [id, s] of Object.entries(obj.situations)) {
    if (!(SITUATION_IDS as readonly string[]).includes(id)) errors.push(`Situation ${id} is not one of the known situations.`);
    else checkSituation(id, s, sourceIds, draft, errors);
  }
  if (errors.length > 0) return errors;

  // The shape is right. Now make sure every situation can be asked at some table.
  const chart = file as HouseChart;
  for (const id of SITUATION_IDS) {
    const s = chart.situations[id] as Situation;
    lookupFor(s);
    if (spotShapes(id, s).length === 0) {
      errors.push(`Situation ${id}: no table size and seat fit its "seats", "players", "limpers" and "raiser", so no question can be made.`);
    }
  }
  return errors;
}

function checkRule(id: string, rule: unknown, sourceIds: Set<string>, draft: boolean, errors: string[]): void {
  const where = `Rule ${id}`;
  if (!isObj(rule)) {
    errors.push(`${where}: must be an object.`);
    return;
  }
  if (!isText(rule.title)) errors.push(`${where}: needs a title.`);
  if (!isText(rule.reason)) errors.push(`${where}: needs a one-line reason.`);
  checkCites(where, rule.sources, sourceIds, draft, errors);
  const unit = RULE_UNITS[id as keyof typeof RULE_UNITS];
  if (rule.unit !== unit) errors.push(`${where}: "unit" must be "${unit}".`);

  if (id === 'D2') {
    checkSpan(`${where}, "base"`, rule.base, errors);
    if (!isNum(rule.perLimper) || rule.perLimper <= 0) errors.push(`${where}: "perLimper" must be a positive number.`);
  } else if (id === 'D3') {
    checkSpan(`${where}, "inPosition"`, rule.inPosition, errors);
    checkSpan(`${where}, "outOfPosition"`, rule.outOfPosition, errors);
  } else if (id === 'D4') {
    for (const key of ['dry', 'wet'] as const) {
      checkSpan(`${where}, "${key}"`, rule[key], errors);
      const span = rule[key];
      if (isObj(span) && isNum(span.min) && isNum(span.max) && span.min <= span.max && fractionsInside({ min: span.min, max: span.max }).length === 0) {
        errors.push(`${where}, "${key}": no choice (1/4, 1/3, 1/2, 2/3, 3/4, pot) falls inside this range, so a question could not be answered.`);
      }
    }
  } else if (id === 'D5') {
    checkSpan(`${where}, "range"`, rule.range, errors);
  }
}

/** Problems in the sizing rules. An empty list means the file is good. */
export function validateSizingRules(file: unknown): string[] {
  const errors: string[] = [];
  const top = checkTop(file, errors);
  if (!top) return errors;
  const { obj, sourceIds, draft } = top;

  if (!isObj(obj.rules)) {
    errors.push('"rules" must be an object.');
    return errors;
  }
  for (const id of RULE_IDS) {
    if (!(id in obj.rules)) errors.push(`Rule ${id} is missing.`);
    else checkRule(id, obj.rules[id], sourceIds, draft, errors);
  }
  for (const id of Object.keys(obj.rules)) {
    if (!(RULE_IDS as string[]).includes(id)) errors.push(`Rule ${id} is not one of D2 to D5.`);
  }
  return errors;
}

export function assertHouseChart(file: unknown): HouseChart {
  const errors = validateHouseChart(file);
  if (errors.length > 0) throw new Error(`Bad house chart:\n${errors.join('\n')}`);
  return file as HouseChart;
}

export function assertSizingRules(file: unknown): SizingRules {
  const errors = validateSizingRules(file);
  if (errors.length > 0) throw new Error(`Bad sizing rules:\n${errors.join('\n')}`);
  return file as SizingRules;
}
