import { describe, expect, it } from 'vitest';
import {
  RATING_VALUE,
  isDue,
  outcomeFor,
  retrievability,
  reviewCard,
  skillBucket,
  sortMostAtRisk,
  type StoredCard,
} from '../../src/engine/scheduler';

const T0 = new Date('2026-10-25T08:00:00Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

// ts-fsrs state numbers
const LEARNING = 1;
const REVIEW = 2;
const RELEARNING = 3;

describe('rating mapping', () => {
  it('maps wrong to Again and right to Good', () => {
    expect(outcomeFor(false)).toBe('again');
    expect(outcomeFor(true)).toBe('good');
  });

  it('maps a placement to Easy whatever the answer', () => {
    expect(outcomeFor(true, true)).toBe('easy');
  });

  it('logs ts-fsrs rating numbers', () => {
    expect(RATING_VALUE).toEqual({ again: 1, good: 3, easy: 4 });
  });
});

describe('reviewCard', () => {
  it('starts a new skill in Learning after Again, due in about a minute', () => {
    const { card } = reviewCard(undefined, T0, 'again');
    expect(card.state).toBe(LEARNING);
    expect(new Date(card.due).getTime() - T0.getTime()).toBe(60_000);
  });

  it('starts a new skill in Learning after Good, due in ten minutes', () => {
    const { card } = reviewCard(undefined, T0, 'good');
    expect(card.state).toBe(LEARNING);
    expect(new Date(card.due).getTime() - T0.getTime()).toBe(10 * 60_000);
  });

  it('places a new skill straight into Review after Easy, with a long first gap', () => {
    const { card } = reviewCard(undefined, T0, 'easy');
    expect(card.state).toBe(REVIEW);
    expect(card.scheduled_days).toBeGreaterThanOrEqual(5);
  });

  it('graduates a learning skill to Review after two Goods', () => {
    const first = reviewCard(undefined, T0, 'good').card;
    const second = reviewCard(first, minutes(11), 'good').card;
    expect(second.state).toBe(REVIEW);
    expect(second.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('moves a reviewed skill to Relearning after Again and counts a lapse', () => {
    const placed = reviewCard(undefined, T0, 'easy').card;
    const lapsed = reviewCard(placed, new Date(placed.due), 'again').card;
    expect(lapsed.state).toBe(RELEARNING);
    expect(lapsed.lapses).toBe(1);
    expect(new Date(lapsed.due).getTime() - new Date(placed.due).getTime()).toBe(10 * 60_000);
  });

  it('keeps dates as ISO strings and survives a JSON round trip', () => {
    const { card } = reviewCard(undefined, T0, 'good');
    expect(typeof card.due).toBe('string');
    expect(typeof card.last_review).toBe('string');
    const again = reviewCard(JSON.parse(JSON.stringify(card)) as StoredCard, minutes(11), 'good');
    expect(again.card.reps).toBe(2);
  });

  it('is deterministic for the same input', () => {
    const a = reviewCard(reviewCard(undefined, T0, 'easy').card, days(8), 'good').card;
    const b = reviewCard(reviewCard(undefined, T0, 'easy').card, days(8), 'good').card;
    expect(a).toEqual(b);
  });

  it('grows the gap after repeated right answers', () => {
    let card = reviewCard(undefined, T0, 'easy').card;
    let gap = card.scheduled_days;
    for (let i = 0; i < 3; i++) {
      card = reviewCard(card, new Date(card.due), 'good').card;
      expect(card.scheduled_days).toBeGreaterThan(gap);
      gap = card.scheduled_days;
    }
  });
});

describe('isDue', () => {
  it('is due at or after the due time only', () => {
    const { card } = reviewCard(undefined, T0, 'again');
    expect(isDue(card, minutes(0))).toBe(false);
    expect(isDue(card, minutes(1))).toBe(true);
    expect(isDue(card, minutes(5))).toBe(true);
  });
});

describe('skillBucket', () => {
  it('is new when there is no card', () => {
    expect(skillBucket(undefined)).toBe('new');
  });

  it('is learning for Learning and Relearning cards', () => {
    expect(skillBucket(reviewCard(undefined, T0, 'good').card)).toBe('learning');
    const placed = reviewCard(undefined, T0, 'easy').card;
    expect(skillBucket(reviewCard(placed, new Date(placed.due), 'again').card)).toBe('learning');
  });

  it('is reviewing under 21 days of stability and strong from 21 days', () => {
    const base = reviewCard(undefined, T0, 'easy').card;
    expect(skillBucket({ ...base, stability: 20.9 })).toBe('reviewing');
    expect(skillBucket({ ...base, stability: 21 })).toBe('strong');
    expect(skillBucket({ ...base, stability: 80 })).toBe('strong');
  });
});

describe('retrievability', () => {
  it('starts near 1 and falls over time', () => {
    const card = reviewCard(undefined, T0, 'easy').card;
    const r0 = retrievability(card, T0);
    const r7 = retrievability(card, days(7));
    const r30 = retrievability(card, days(30));
    expect(r0).toBeGreaterThan(0.99);
    expect(r7).toBeLessThan(r0);
    expect(r30).toBeLessThan(r7);
  });

  it('is about 0.9 when a card is due', () => {
    const card = reviewCard(undefined, T0, 'easy').card;
    expect(retrievability(card, new Date(card.due))).toBeGreaterThan(0.85);
    expect(retrievability(card, new Date(card.due))).toBeLessThan(0.95);
  });

  it('uses fractional days so same-day cards still differ', () => {
    const card = reviewCard(undefined, T0, 'good').card;
    expect(retrievability(card, minutes(60))).toBeLessThan(retrievability(card, minutes(5)));
  });
});

describe('sortMostAtRisk', () => {
  it('puts the lowest retrievability first', () => {
    const fresh = reviewCard(undefined, days(9), 'easy').card; // reviewed later, so fresher
    const stale = reviewCard(undefined, T0, 'easy').card;
    const items = [
      { id: 'fresh', card: fresh },
      { id: 'stale', card: stale },
    ];
    const sorted = sortMostAtRisk(items, days(10));
    expect(sorted.map((i) => i.id)).toEqual(['stale', 'fresh']);
  });

  it('does not change the input array', () => {
    const a = reviewCard(undefined, T0, 'easy').card;
    const items = [{ id: 'a', card: a }];
    expect(sortMostAtRisk(items, days(10))).not.toBe(items);
  });
});
