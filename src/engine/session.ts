import type { Curriculum, SkillRecord, SkillRecords } from './curriculum';
import { addDays, dayKey, dayStart } from './day';
import { createRng, deriveSeed, type Rng } from './rng';
import { isDue, outcomeFor, reviewCard, sortMostAtRisk, type Outcome } from './scheduler';
import type { Answer, GradeResult, Question, SkillDef } from './types';

const MIN_MS = 60_000;
/** A new skill is only introduced with at least this much time left. */
const NEW_SKILL_MIN_REMAINING_MS = 2 * MIN_MS;
const PRACTICE_QUESTIONS_MAX = 3;
const RETRY_MIN_GAP = 2;
const RETRY_MAX_GAP = 4;

export interface SessionSettings {
  /** 5, 10, 15 or 20. */
  sessionMinutes: number;
  /** New skills introduced per session, 1 to 3 (0 is allowed for tests). */
  newPerSession: number;
}

export interface ReviewLogRecord {
  skillId: string;
  at: string;
  correct: boolean;
  /** The ts-fsrs rating this answer applied, or 0 if it did not change the schedule. */
  rating: number;
  ms: number;
  seed: number;
  practice: boolean;
}

export interface SessionRecord {
  dayKey: string;
  startedAt: string;
  endedAt: string;
  answered: number;
  correct: number;
  finished: boolean;
}

/** Emitted for every answer. `record` is present only when the skill's schedule changed. */
export interface ReviewEvent {
  log: ReviewLogRecord;
  record?: SkillRecord;
}

export type Purpose = 'review' | 'retry' | 'probe' | 'practice';

export interface SessionSummary {
  answered: number;
  correct: number;
  /** 0 to 1, or null if nothing was answered. */
  accuracy: number | null;
  finished: boolean;
  /** Ids of the skills introduced in this session. */
  newSkills: string[];
  /** Skills that will be due by the end of tomorrow. */
  dueTomorrow: number;
}

export type Step =
  | {
      kind: 'question';
      skillId: string;
      purpose: Purpose;
      question: Question;
      /** 1 or 2 when purpose is 'probe'. */
      probeNumber?: 1 | 2;
      /** Set once the question has been answered. */
      result?: GradeResult;
      /** Set with the result when this answer placed a new skill straight into reviews. */
      placed?: boolean;
    }
  | { kind: 'explainer'; skill: SkillDef }
  | { kind: 'ended'; summary: SessionSummary };

export interface SessionOptions {
  curriculum: Curriculum;
  records: SkillRecords;
  settings: SessionSettings;
  now: () => Date;
  /** Seeds every question and retry gap in the session. */
  seed: number;
  onReview?: (event: ReviewEvent) => void;
  onEnd?: (record: SessionRecord) => void;
}

interface Intro {
  skill: SkillDef;
  probeCorrect: boolean[];
  practiceAsked: number;
  lastPracticeCorrect: boolean | null;
  /** True once the first FSRS rating has been applied. */
  rated: boolean;
}

interface Retry {
  skillId: string;
  /** Index of the question that should be the retry. */
  atIndex: number;
}

export class Session {
  private readonly o: SessionOptions;
  private readonly records: Map<string, SkillRecord>;
  private readonly rng: Rng;
  private readonly startedAt: Date;
  private readonly endAt: Date;
  private queue: string[];
  private retries: Retry[] = [];
  private intro: Intro | null = null;
  private introduced: string[] = [];
  /** Questions served so far. The latest question has this index. */
  private served = 0;
  private seedCounter = 0;
  private answered = 0;
  private correct = 0;
  private shownAt: Date;
  private current!: Step;

  constructor(options: SessionOptions) {
    this.o = options;
    this.records = new Map(options.records);
    this.rng = createRng(deriveSeed(options.seed, 0x5e55));
    this.startedAt = options.now();
    this.endAt = new Date(this.startedAt.getTime() + options.settings.sessionMinutes * MIN_MS);
    this.shownAt = this.startedAt;

    const due = [...this.records.values()].filter((r) => isDue(r.card, this.startedAt));
    this.queue = sortMostAtRisk(due, this.startedAt).map((r) => r.skillId);

    this.pickNext();
  }

  get step(): Step {
    return this.current;
  }

  /** Milliseconds left on the timer, never below zero. */
  remainingMs(): number {
    return Math.max(this.endAt.getTime() - this.o.now().getTime(), 0);
  }

  /** The skill records as they stand now, including changes made in this session. */
  currentRecords(): ReadonlyMap<string, SkillRecord> {
    return this.records;
  }

  /** Grade the answer, update the schedule and log it. Call advance() afterwards. */
  submit(answer: Answer): GradeResult {
    const step = this.current;
    if (step.kind !== 'question') throw new Error('No question to answer');
    if (step.result) throw new Error('Question already answered');

    const now = this.o.now();
    const result = step.question.grade(answer);
    const ms = Math.max(now.getTime() - this.shownAt.getTime(), 0);
    this.answered++;
    if (result.correct) this.correct++;
    step.result = result;

    const log = (rating: number): ReviewLogRecord => ({
      skillId: step.skillId,
      at: now.toISOString(),
      correct: result.correct,
      rating,
      ms,
      seed: step.question.seed,
      practice: false,
    });

    if (step.purpose === 'review' || step.purpose === 'retry') {
      this.applyRating(step.skillId, now, outcomeFor(result.correct), log);
      if (!result.correct) {
        const gap = this.rng.int(RETRY_MIN_GAP, RETRY_MAX_GAP);
        this.retries.push({ skillId: step.skillId, atIndex: this.served + gap });
      }
      return result;
    }

    const intro = this.intro;
    if (!intro) throw new Error('Probe or practice answer without an introduction');

    if (step.purpose === 'probe') {
      intro.probeCorrect.push(result.correct);
      const placed = intro.probeCorrect.length === 2 && intro.probeCorrect.every(Boolean);
      if (placed) {
        this.applyRating(intro.skill.id, now, outcomeFor(true, true), log, true);
        intro.rated = true;
        step.placed = true;
      } else {
        this.emit({ log: log(0) });
      }
      return result;
    }

    // Practice: only the last answer sets the first rating.
    intro.practiceAsked++;
    intro.lastPracticeCorrect = result.correct;
    if (result.correct || intro.practiceAsked >= PRACTICE_QUESTIONS_MAX) {
      this.applyRating(intro.skill.id, now, outcomeFor(result.correct), log, true);
      intro.rated = true;
    } else {
      this.emit({ log: log(0) });
    }
    return result;
  }

  /** Move on from feedback or from the explainer. */
  advance(): void {
    const step = this.current;
    if (step.kind === 'ended') return;

    if (step.kind === 'explainer') {
      this.servePractice();
      return;
    }
    if (!step.result) throw new Error('Answer the question first');

    if (this.o.now().getTime() >= this.endAt.getTime()) {
      this.end(true);
      return;
    }

    const intro = this.intro;
    if (intro) {
      if (step.purpose === 'probe') {
        if (intro.probeCorrect.length < 2) {
          this.serveProbe(2);
        } else if (intro.rated) {
          this.intro = null; // placed
          this.pickNext();
        } else {
          this.current = { kind: 'explainer', skill: intro.skill };
        }
        return;
      }
      if (intro.rated) {
        this.intro = null;
        this.pickNext();
      } else {
        this.servePractice();
      }
      return;
    }
    this.pickNext();
  }

  /** Stop now. The session does not count as finished. */
  quit(): void {
    if (this.current.kind !== 'ended') this.end(false);
  }

  // ---- internals ----

  private nextSeed(): number {
    this.seedCounter++;
    return deriveSeed(this.o.seed, this.seedCounter);
  }

  private serve(skillId: string, purpose: Purpose, probeNumber?: 1 | 2): void {
    const skill = this.o.curriculum.get(skillId);
    this.served++;
    this.shownAt = this.o.now();
    const step: Step = { kind: 'question', skillId, purpose, question: skill.generate(this.nextSeed()) };
    if (probeNumber) step.probeNumber = probeNumber;
    this.current = step;
  }

  private serveProbe(n: 1 | 2): void {
    this.serve(this.intro!.skill.id, 'probe', n);
  }

  private servePractice(): void {
    this.serve(this.intro!.skill.id, 'practice');
  }

  private pickNext(): void {
    const nextIndex = this.served + 1;

    const ready = this.retries.findIndex((r) => r.atIndex <= nextIndex);
    if (ready >= 0) {
      this.serve(this.retries.splice(ready, 1)[0]!.skillId, 'retry');
      return;
    }
    if (this.queue.length > 0) {
      this.serve(this.queue.shift()!, 'review');
      return;
    }
    if (this.retries.length > 0) {
      // Nothing else to ask, so the retry comes early.
      const soonest = this.retries.reduce((a, b) => (b.atIndex < a.atIndex ? b : a));
      this.retries = this.retries.filter((r) => r !== soonest);
      this.serve(soonest.skillId, 'retry');
      return;
    }

    const canIntroduce =
      this.remainingMs() >= NEW_SKILL_MIN_REMAINING_MS &&
      this.introduced.length < this.o.settings.newPerSession;
    const next = canIntroduce ? this.o.curriculum.nextToIntroduce(this.records) : undefined;
    if (next) {
      this.intro = { skill: next, probeCorrect: [], practiceAsked: 0, lastPracticeCorrect: null, rated: false };
      this.introduced.push(next.id);
      this.serveProbe(1);
      return;
    }
    this.end(true);
  }

  /** Apply a rating to a skill, save the new record and emit the event. */
  private applyRating(
    skillId: string,
    now: Date,
    outcome: Outcome,
    makeLog: (rating: number) => ReviewLogRecord,
    isNewSkill = false,
  ): SkillRecord {
    const existing = this.records.get(skillId);
    const { card, rating } = reviewCard(existing?.card, now, outcome);
    const record: SkillRecord = {
      skillId,
      card,
      introducedAt: isNewSkill && !existing ? now.toISOString() : (existing?.introducedAt ?? now.toISOString()),
    };
    this.records.set(skillId, record);
    this.emit({ log: makeLog(rating), record });
    return record;
  }

  private emit(event: ReviewEvent): void {
    this.o.onReview?.(event);
  }

  /** `finished` is true when the timer ran out or nothing was left to do. */
  private end(finished: boolean): void {
    // If the timer ran out during practice, the last practice answer still sets the first rating.
    const intro = this.intro;
    if (intro && !intro.rated && intro.practiceAsked > 0 && intro.lastPracticeCorrect !== null) {
      const now = this.o.now();
      const step = this.current;
      this.applyRating(
        intro.skill.id,
        now,
        outcomeFor(intro.lastPracticeCorrect),
        (rating) => ({
          skillId: intro.skill.id,
          at: now.toISOString(),
          correct: intro.lastPracticeCorrect === true,
          rating,
          ms: 0,
          seed: step.kind === 'question' ? step.question.seed : 0,
          practice: false,
        }),
        true,
      );
      intro.rated = true;
    }
    this.intro = null;

    const endedAt = this.o.now();
    const summary = this.summary(finished);
    this.current = { kind: 'ended', summary };
    this.o.onEnd?.({
      dayKey: dayKey(this.startedAt),
      startedAt: this.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      answered: this.answered,
      correct: this.correct,
      finished,
    });
  }

  private summary(finished: boolean): SessionSummary {
    const horizon = dayStart(addDays(dayKey(this.o.now()), 2));
    const dueTomorrow = [...this.records.values()].filter(
      (r) => new Date(r.card.due).getTime() < horizon.getTime(),
    ).length;
    return {
      answered: this.answered,
      correct: this.correct,
      accuracy: this.answered === 0 ? null : this.correct / this.answered,
      finished,
      newSkills: this.introducedAndRecorded(),
      dueTomorrow,
    };
  }

  private introducedAndRecorded(): string[] {
    return this.introduced.filter((id) => this.records.has(id));
  }
}

/** Extra practice from the skill map. Never touches the schedule. */
export interface PracticeOptions {
  skill: SkillDef;
  now: () => Date;
  seed: number;
  onReview?: (event: ReviewEvent) => void;
}

export class PracticeRun {
  private readonly o: PracticeOptions;
  private counter = 0;
  private shownAt: Date;
  private answeredCount = 0;
  private correctCount = 0;
  private answeredThis = false;
  question: Question;

  constructor(options: PracticeOptions) {
    this.o = options;
    this.shownAt = options.now();
    this.question = this.make();
  }

  get stats(): { answered: number; correct: number } {
    return { answered: this.answeredCount, correct: this.correctCount };
  }

  submit(answer: Answer): GradeResult {
    if (this.answeredThis) throw new Error('Question already answered');
    this.answeredThis = true;
    const now = this.o.now();
    const result = this.question.grade(answer);
    this.answeredCount++;
    if (result.correct) this.correctCount++;
    this.o.onReview?.({
      log: {
        skillId: this.o.skill.id,
        at: now.toISOString(),
        correct: result.correct,
        rating: 0,
        ms: Math.max(now.getTime() - this.shownAt.getTime(), 0),
        seed: this.question.seed,
        practice: true,
      },
    });
    return result;
  }

  next(): void {
    this.question = this.make();
    this.answeredThis = false;
    this.shownAt = this.o.now();
  }

  private make(): Question {
    this.counter++;
    return this.o.skill.generate(deriveSeed(this.o.seed, this.counter));
  }
}
