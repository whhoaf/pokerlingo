"""Layout check on a 390 by 844 phone: does each question and each feedback sheet fit without scrolling?

Start the preview server first:   npx vite preview --port 4173
Then run:  /home/hermes/venvs/scrape/bin/python scripts/layout_check.py [skill ids] [--n 20]

For every Area A and D skill (or the ones named) it practises N questions with random seeds and checks:
  - the question: the prompt, every choice (or the number field) and the Check button end above the bottom of the
    screen, so nothing needs a scroll;
  - the feedback sheet at scroll position 0: the result word, the answer, the reason and, in Area A, your hand on the
    grid and the key are inside the part of the sheet you can see, and Next is on screen;
  - the seat picture: no two seats or tags overlap, and nothing leaves the screen sideways.
"""

from __future__ import annotations

import glob
import os
import re
import sys

from playwright.sync_api import Page, sync_playwright

from screenshots import (
    BASE,
    SEED_DUE_JS,
    VIEWPORT,
    click,
    number_answer,
    open_tab,
    settle,
    sizing_answer,
    skill_row,
    wait_for_feedback,
)

DEFAULT_SKILLS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "D2", "D3", "D4", "D5"]
H = VIEWPORT["height"]

problems: list[str] = []
worst: dict[str, dict[str, float]] = {}


def problem(msg: str) -> None:
    if msg not in problems:
        problems.append(msg)
        print("PROBLEM:", msg)


def note_worst(skill: str, key: str, value: float) -> None:
    row = worst.setdefault(skill, {})
    row[key] = max(row.get(key, -1e9), value)


QUESTION_JS = """
() => {
  const bottoms = [];
  for (const el of document.querySelectorAll('.prompt, .choice, .numfield, form .btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    // The hard shadow under a button is 6 px.
    bottoms.push(r.bottom + (el.classList.contains('prompt') ? 0 : 6));
  }
  return { lowest: Math.max(...bottoms), page: document.documentElement.scrollHeight };
}
"""

SHEET_JS = """
() => {
  const body = document.querySelector('.sheet-body');
  if (!body) return null;
  body.scrollTop = 0;
  const box = body.getBoundingClientRect();
  const out = { sheetTop: document.querySelector('.sheet').getBoundingClientRect().top, bodyBottom: box.bottom, items: {} };
  for (const [name, sel] of [['result', '.res-word'], ['answer', '.ansline'], ['reason', '.why'], ['grid', '.sheet .rg'],
                             ['yours', '.sheet .rg-cell--yours'], ['key', '.sheet .rg-key']]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out.items[name] = { top: r.top, bottom: r.bottom };
  }
  const next = document.querySelector('.sheet-foot .btn').getBoundingClientRect();
  out.next = { top: next.top, bottom: next.bottom };
  out.scrolls = body.scrollHeight > body.clientHeight + 1;
  return out;
}
"""

SEATS_JS = """
() => {
  const boxes = [];
  for (const el of document.querySelectorAll('.ring .seat-pill, .ring .seat-tag, .ring .seat-button')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const seat = el.closest('.seat');
    boxes.push({ name: (seat ? seat.innerText : '').replace(/\\s+/g, ' ').trim() + '/' + el.className, l: r.left, r: r.right, t: r.top, b: r.bottom, seat: seat ? [...seat.parentNode.children].indexOf(seat) : -1, kind: el.className });
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.seat === b.seat) continue;
      // A button chip may sit on its own seat's corner, but not on another seat.
      if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) hits.push(a.name + ' overlaps ' + b.name);
    }
  }
  const ring = document.querySelector('.ring');
  const w = window.innerWidth;
  for (const b of boxes) if (b.l < 0 || b.r > w) hits.push('off screen: ' + b.name);
  return hits;
}
"""


def bootstrap(page: Page) -> None:
    """A first session, so that skill records exist; then every skill is seeded as met."""
    page.goto(BASE)
    page.get_by_text("Welcome").wait_for()
    click(page, "Start a 10-minute session")
    for _ in range(40):
        page.locator(".prompt, :text('Session complete'), :text('Take a minute with this one')").first.wait_for()
        if page.get_by_text("Session complete").count() > 0:
            break
        if page.get_by_text("Take a minute with this one").count() > 0:
            click(page, "Start practice")
            continue
        if page.locator(".choice").count() > 0:
            page.locator(".choice").first.click()
        else:
            number_answer(page, "9")
        wait_for_feedback(page)
        click(page, re.compile("^(Next|Finish session)$"))
    page.get_by_text("Session complete").wait_for()
    click(page, "Done")
    page.get_by_text("Done for today").wait_for()
    page.evaluate(SEED_DUE_JS)
    page.reload()
    page.get_by_text("still due will roll over").wait_for()


def check_skill(page: Page, skill_id: str, n: int) -> None:
    open_tab(page, "Skills")
    page.get_by_text("Reading the board").wait_for()
    skill_row(page, skill_id).click()
    page.get_by_text("Worked example").wait_for()
    click(page, "Practise")
    page.locator(".hud-info", has_text=skill_id).wait_for()
    for i in range(n):
        page.locator(".prompt").wait_for()
        settle(page, 100)
        where = f"{skill_id} question {i + 1}"
        q = page.evaluate(QUESTION_JS)
        note_worst(skill_id, "question bottom", q["lowest"])
        if q["lowest"] > H:
            problem(f"{where}: the choices or Check end at {q['lowest']:.0f} px, below the {H} px screen")
        for hit in page.evaluate(SEATS_JS):
            problem(f"{where}: seat picture: {hit}")
        prompt = page.locator(".prompt").inner_text()
        if page.locator(".choice").count() > 0:
            page.locator(".choice").nth(i % page.locator(".choice").count()).click()
        elif skill_id in ("D2", "D3", "D5"):
            number_answer(page, sizing_answer(page, skill_id, prompt) if i % 2 == 0 else "1")
        else:
            number_answer(page, "1")
        wait_for_feedback(page)
        settle(page, 100)
        where = f"{skill_id} feedback {i + 1}"
        s = page.evaluate(SHEET_JS)
        if s is None:
            problem(f"{where}: no sheet")
        else:
            for name, box in s["items"].items():
                note_worst(skill_id, f"sheet {name} bottom over", box["bottom"] - s["bodyBottom"])
                if name in ("result", "answer", "reason", "yours", "key") and (box["bottom"] > s["bodyBottom"] + 1 or box["top"] < s["sheetTop"]):
                    problem(f"{where}: {name} is not visible without scrolling the sheet (bottom {box['bottom']:.0f}, visible to {s['bodyBottom']:.0f})")
            if s["next"]["bottom"] > H + 1:
                problem(f"{where}: Next ends at {s['next']['bottom']:.0f} px")
        for hit in page.evaluate(SEATS_JS):
            problem(f"{where}: seat picture: {hit}")
        click(page, "Next question")
    click(page, "Done", exact=True)
    page.get_by_text("Next review").wait_for()
    click(page, "Back")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    n = 20
    if "--n" in args:
        k = args.index("--n")
        n = int(args[k + 1])
        del args[k : k + 2]
    skills = args or DEFAULT_SKILLS
    chromium = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    if not chromium:
        sys.exit("No Chromium found under ~/.cache/ms-playwright")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium[0], args=["--no-sandbox"])
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        bootstrap(page)
        for sid in skills:
            check_skill(page, sid, n)
            print(sid, {k: round(v) for k, v in worst.get(sid, {}).items()})
        browser.close()
    print()
    if problems:
        print(f"{len(problems)} problem(s)")
        sys.exit(1)
    print("Every question and sheet fits on a 390 by 844 screen.")


if __name__ == "__main__":
    main()
