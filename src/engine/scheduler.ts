import { Rating, State, createEmptyCard, fsrs, generatorParameters, type Card } from 'ts-fsrs';

/** An FSRS card with its dates as ISO strings, so it can sit in IndexedDB and in a backup file. */
export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export type Outcome = 'again' | 'good' | 'easy';
export type Bucket = 'new' | 'learning' | 'reviewing' | 'strong';

export const RATING_VALUE: Record<Outcome, number> = {
  again: Rating.Again,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Stability, in days, from which a skill counts as strong. */
export const STRONG_STABILITY_DAYS = 21;

const DAY_MS = 86_400_000;

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }),
);

function fromStored(card: StoredCard): Card {
  const out: Card = {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
  };
  if (card.last_review) out.last_review = new Date(card.last_review);
  return out;
}

function toStored(card: Card): StoredCard {
  const out: StoredCard = {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
  if (card.last_review) out.last_review = card.last_review.toISOString();
  return out;
}

/** Right is Good, wrong is Again. A placement (both probes right) is Easy. */
export function outcomeFor(correct: boolean, placement = false): Outcome {
  if (placement) return 'easy';
  return correct ? 'good' : 'again';
}

/** Apply one graded answer. A skill with no card yet starts from an empty one. */
export function reviewCard(
  card: StoredCard | undefined,
  now: Date,
  outcome: Outcome,
): { card: StoredCard; rating: number } {
  const current = card ? fromStored(card) : createEmptyCard(now);
  const rating = RATING_VALUE[outcome];
  const next = scheduler.next(current, now, rating as 1 | 3 | 4).card;
  return { card: toStored(next), rating };
}

export function isDue(card: StoredCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Chance of recalling the skill now. Uses fractional days so same-day cards still differ. */
export function retrievability(card: StoredCard, now: Date): number {
  if (card.state === State.New || !card.last_review) return 0;
  const elapsed = Math.max((now.getTime() - new Date(card.last_review).getTime()) / DAY_MS, 0);
  return scheduler.forgetting_curve(elapsed, card.stability);
}

/** The map state of a skill that has been introduced. `undefined` means never introduced. */
export function skillBucket(card: StoredCard | undefined): Bucket {
  if (!card || card.state === State.New) return 'new';
  if (card.state === State.Learning || card.state === State.Relearning) return 'learning';
  return card.stability >= STRONG_STABILITY_DAYS ? 'strong' : 'reviewing';
}

/** Lowest retrievability first: the skills most at risk of being forgotten. */
export function sortMostAtRisk<T extends { card: StoredCard }>(items: readonly T[], now: Date): T[] {
  return items
    .map((item) => ({ item, r: retrievability(item.card, now) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.item);
}
