import { backFromButton, seatNames } from '../../engine/seats';
import type { Answer, GradeResult, Question, SkillDef } from '../../engine/types';
import { choiceOf, rngFor } from '../B/common';
import { AREA_A_READING, hiddenRing } from './common';

/** Seat names in the order they act, comma separated. */
function order(players: number): string {
  return seatNames(players).join(', ');
}

function whyThisSeat(seat: string, players: number): string {
  if (seat === 'BTN') return 'The dealer button marks the BTN.';
  if (seat === 'SB') return 'The seat just after the button is the small blind (SB).';
  if (seat === 'BB') return 'The seat after the small blind is the big blind (BB).';
  const back = backFromButton(seat, players) as number;
  return `Count back from the button: this seat is ${back === 1 ? '1 seat' : `${back} seats`} back, so it is ${seat}.`;
}

export const A1: SkillDef = {
  id: 'A1',
  area: 'A',
  title: 'Name the seats at a 6 to 9 player table',
  prereqs: [],
  generate(seed): Question {
    const rng = rngFor('A1', seed);
    const players = rng.int(6, 9);
    const names = seatNames(players);
    const seat = rng.pick(names);
    const distractors = rng.shuffle(names.filter((n) => n !== seat)).slice(0, 3);
    const options = rng.shuffle([seat, ...distractors]).map((n) => ({ id: n, label: n }));

    return {
      skillId: 'A1',
      seed,
      prompt: 'Which seat is the highlighted one?',
      table: { ring: hiddenRing(players, seat), note: `${players} players. D is the dealer button.` },
      input: { kind: 'choice', options },
      grade(answer: Answer): GradeResult {
        return {
          correct: choiceOf(answer) === seat,
          correctLabel: seat,
          reason: whyThisSeat(seat, players),
          working: [
            `Order of play at ${players} players: ${order(players)}.`,
            'After the flop the order starts at the small blind, so the button acts last.',
          ],
        };
      },
    };
  },
  explainer: {
    body: [
      'Seats are named by where they sit compared with the dealer button. The button is BTN. The seat before it is the cutoff (CO), then the hijack (HJ), then the lojack (LJ). Count back from the button to name a seat.',
      'The two seats after the button pay the blinds: the small blind (SB) and then the big blind (BB). The first seat after the big blind is the first to act before the flop.',
      'With 7 to 9 players there are early seats before the lojack: UTG, then UTG+1 and UTG+2. At a 6-player table the first seat to act is called UTG, but it plays like the lojack.',
      'Play moves clockwise. Before the flop the order is first seat, then round to the button, then the small blind and the big blind.',
    ],
    example: {
      prompt: 'Which seat is the highlighted one?',
      table: { ring: hiddenRing(8, 'HJ'), note: '8 players. D is the dealer button.' },
      answer: 'HJ',
      working: [
        'Count back from the button: this seat is 2 seats back, so it is HJ.',
        `Order of play at 8 players: ${order(8)}.`,
      ],
    },
  },
  furtherReading: AREA_A_READING,
};
