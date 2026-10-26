"""Visual check: drive the built app in Chromium and save 390x844 screenshots.

Start the preview server first:   npx vite preview --port 4173
Then run:  /home/hermes/venvs/scrape/bin/python scripts/screenshots.py

Screenshots go to screenshots/ (gitignored). The script also fails loudly on
horizontal overflow, clipped text, console errors, a lost session after reload,
a broken export and import round trip, and a broken offline start.
"""

from __future__ import annotations

import glob
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE = "http://localhost:4173/pokerlingo/"
OUT = Path(__file__).resolve().parent.parent / "screenshots"
IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
VIEWPORT = {"width": 390, "height": 844}

problems: list[str] = []
console_errors: list[str] = []


def problem(msg: str) -> None:
    problems.append(msg)
    print("PROBLEM:", msg)


CHECK_LAYOUT_JS = """
() => {
  const w = window.innerWidth;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.classList.contains('visually-hidden')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > w + 1 || r.left < -1) bad.push('outside: ' + el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
      bad.push('clipped: ' + el.tagName + '.' + el.className);
    }
  }
  const page = document.documentElement.scrollWidth - w;
  if (page > 0) bad.push('page scrolls sideways by ' + page + 'px');
  return bad;
}
"""

TAP_TARGETS_JS = """
() => {
  const small = [];
  for (const el of document.querySelectorAll('button, a, input, .choice, .tab')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.classList.contains('visually-hidden')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 47.5) small.push(el.tagName + ' ' + (el.textContent || '').trim().slice(0, 30) + ' h=' + Math.round(r.height));
  }
  return small;
}
"""


ANIMATIONS_DONE_JS = "() => document.getAnimations().every((a) => !(a instanceof CSSAnimation) || a.playState !== 'running')"


def settle(page: Page, extra: int = 150) -> None:
    """Wait for the cards to be dealt and the sheet to land, so the picture shows the finished screen."""
    page.wait_for_function(ANIMATIONS_DONE_JS, timeout=8000)
    page.wait_for_timeout(extra)


def shot(page: Page, name: str) -> None:
    settle(page, 500 if "summary" in name else 150)  # numbers roll up for 300 ms on the summary
    for item in page.evaluate(CHECK_LAYOUT_JS):
        problem(f"{name}: {item}")
    for item in page.evaluate(TAP_TARGETS_JS):
        problem(f"{name}: small tap target: {item}")
    # The feedback sheet is fixed to the bottom of the screen. A full-page picture would stretch it, so
    # screens with a sheet are captured as the phone shows them.
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=page.locator(".sheet").count() == 0)
    print("saved", name)


def number_answer(page: Page, value: str) -> None:
    page.locator("input[type=text]").fill(value)
    page.get_by_role("button", name="Check").click()


CANVAS_TONE_JS = """
() => {
  const c = document.getElementById('bg');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const sum = [0, 0, 0];
  for (let k = 0; k < d.length; k += 4) for (let i = 0; i < 3; i++) sum[i] += d[k + i];
  return sum.map((v) => v / (d.length / 4));
}
"""

# What each mood of the background must look like, as a test on the average colour.
TONES = {
    "green": lambda r, g, b: g > r and g > b,
    "blue": lambda r, g, b: b > r and b > g,
    "red": lambda r, g, b: r > g * 1.5 and r > b * 1.5,
    "purple": lambda r, g, b: r > g and b > g,
}


def expect_tone(page: Page, mood: str, where: str) -> None:
    """The background blends to its new colours over about a second, so poll for a while."""
    for _ in range(40):
        r, g, b = page.evaluate(CANVAS_TONE_JS)
        if TONES[mood](r, g, b):
            return
        page.wait_for_timeout(100)
    problem(f"{where}: the background should be {mood}, average colour is {r:.0f}, {g:.0f}, {b:.0f}")


def open_tab(page: Page, name: str) -> None:
    """Go to Today, Skills or Settings. Home has buttons instead of the tab bar."""
    tab = page.locator(".tab", has_text=name)
    if tab.count() > 0:
        tab.click()
    else:
        label = {"Skills": "Skill map", "Settings": "Settings"}[name]
        page.get_by_role("button", name=label, exact=True).click()


def wait_tag(page: Page, label: str, value: str) -> None:
    """Wait for the tag in the top bar, for example New skill and 1 of 2."""
    page.locator(".hud .tag", has_text=re.compile(label, re.I)).filter(has_text=value).wait_for()


def click(page: Page, name: str, exact: bool = False) -> None:
    page.get_by_role("button", name=name, exact=exact).click()


def dump_db(page: Page) -> dict:
    return page.evaluate(
        """
        async () => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open('pokerlingo');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const all = (s) => new Promise((res, rej) => {
            const r = db.transaction(s).objectStore(s).getAll();
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const out = {};
          for (const s of ['skillStates', 'reviewLogs', 'sessions']) out[s] = await all(s);
          const keys = await new Promise((res) => { const r = db.transaction('meta').objectStore('meta').getAllKeys(); r.onsuccess = () => res(r.result); });
          const vals = await new Promise((res) => { const r = db.transaction('meta').objectStore('meta').getAll(); r.onsuccess = () => res(r.result); });
          out.meta = {};
          keys.forEach((k, i) => { out.meta[k] = vals[i]; });
          db.close();
          return out;
        }
        """
    )


# Every skill, in the app's intro order.
SKILL_IDS = [
    "B1", "C1", "B2", "C2", "B3", "A1", "C3", "B4", "A2", "C4", "B5", "A3", "C5", "B6", "A4", "C6", "B7", "D1",
    "A5", "B8", "A6", "B9", "A7", "D2", "A8", "A9", "D3", "D4", "D5",
]
# The sixteen skills a player had before Areas A and D were added.
OLD_SKILL_IDS = ["B1", "C1", "B2", "C2", "B3", "C3", "B4", "C4", "B5", "C5", "B6", "C6", "B7", "D1", "B8", "B9"]

REPO = Path(__file__).resolve().parent.parent
CHART = json.loads((REPO / "content" / "house-chart.json").read_text())
RULES = json.loads((REPO / "content" / "sizing-rules.json").read_text())
# Skills that teach advice from a content file. They show the "Draft advice" note while the file is a draft.
ADVICE_DRAFT = {
    **{sid: CHART["draft"] for sid in ["A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"]},
    **{sid: RULES["draft"] for sid in ["D2", "D3", "D4", "D5"]},
}
# Skills with a seat picture, and those that show the chart grid after an answer.
RING_SKILLS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "D2", "D3"]
GRID_SKILLS = ["A2", "A3", "A4", "A5", "A6", "A7", "A8"]

# Makes every random seed in the app repeatable, so a run gives the same screenshots.
FIXED_SEEDS_JS = """
(() => {
  let s = 20261025;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const orig = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (arr) => {
    if (arr instanceof Uint32Array && arr.length === 1) { arr[0] = next(); return arr; }
    return orig(arr);
  };
})();
"""

SEED_DUE_JS = """
async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('pokerlingo');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const store = (mode) => db.transaction('skillStates', mode).objectStore('skillStates');
  const base = await new Promise((res) => { const r = store('readonly').get('B1'); r.onsuccess = () => res(r.result); });
  const past = new Date(Date.now() - 3 * 86400000).toISOString();
  const ids = %s;
  const tx = db.transaction('skillStates', 'readwrite');
  ids.forEach((id, i) => {
    const days = 5 + i * 2;
    tx.objectStore('skillStates').put({
      skillId: id,
      introducedAt: base.introducedAt,
      card: { ...base.card, due: past, last_review: new Date(Date.now() - days * 86400000).toISOString() },
    });
  });
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
}
""" % json.dumps(SKILL_IDS)

# The sixteen older skills are met and not due for ten days. Every Area A and D skill is removed, so the next
# session introduces A1. Mimics a player who started before Areas A and D existed.
INTRO_SEED_JS = """
async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('pokerlingo');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const base = await new Promise((res) => { const r = db.transaction('skillStates', 'readonly').objectStore('skillStates').get('B1'); r.onsuccess = () => res(r.result); });
  const future = new Date(Date.now() + 10 * 86400000).toISOString();
  const last = new Date(Date.now() - 2 * 86400000).toISOString();
  const keep = %s;
  const all = %s;
  const tx = db.transaction('skillStates', 'readwrite');
  for (const id of all) {
    if (keep.includes(id)) {
      tx.objectStore('skillStates').put({ skillId: id, introducedAt: base.introducedAt, card: { ...base.card, due: future, last_review: last } });
    } else {
      tx.objectStore('skillStates').delete(id);
    }
  }
  await new Promise((res) => { tx.oncomplete = res; });
  db.close();
}
""" % (json.dumps(OLD_SKILL_IDS), json.dumps(SKILL_IDS))


def answer_any(page: Page, index: int = 0) -> None:
    """Answer the question on screen: choice number `index` (wrapping), or 1 for a number question."""
    choices = page.locator(".choice")
    if choices.count() > 0:
        choices.nth(index % choices.count()).click()
    else:
        number_answer(page, "1")


def wait_for_feedback(page: Page) -> str:
    """Wait for the feedback panel and say whether it was right."""
    page.locator(".res-word").wait_for()
    return "correct" if page.locator(".res-word").inner_text().strip() == "Right!" else "wrong"


def skill_row(page: Page, skill_id: str):
    return page.locator(".skill-row").filter(has=page.locator(".skill-id", has_text=re.compile(f"^{skill_id}$")))


def d1_answer(prompt: str) -> str:
    """The right chips for a D1 prompt, worked out here from the text on screen."""
    pot = int(re.search(r"The pot is (\d+)\.", prompt).group(1))
    fractions = {
        "a third of the pot": 1 / 3,
        "half the pot": 1 / 2,
        "two thirds of the pot": 2 / 3,
        "three quarters of the pot": 3 / 4,
        "the whole pot": 1,
    }
    for words, f in fractions.items():
        if f"bet of {words}" in prompt:
            return str(round(pot * f))
    raise ValueError("unknown D1 prompt: " + prompt)


def half_up(x: float) -> int:
    """Round half up, like Math.round in the app."""
    return int(x + 0.5 + 1e-9)


def sizing_answer(page: Page, skill_id: str, prompt: str) -> str:
    """The lowest right answer for D2, D3 or D5, worked out here from the rules file and the text on screen."""
    if skill_id == "D2":
        if "Everyone before you folds" in prompt:
            limpers = 0
        elif "1 player limps" in prompt:
            limpers = 1
        else:
            limpers = int(re.search(r"(\d+) players limp", prompt).group(1))
        rule = RULES["rules"]["D2"]
        return str(half_up((rule["base"]["min"] + rule["perLimper"] * limpers) * 2))
    if skill_id == "D3":
        open_to = int(re.search(r"raises to (\d+) chips", prompt).group(1))
        hero = page.locator(".seat--you .seat-name").inner_text().strip()
        rule = RULES["rules"]["D3"]
        span = rule["inPosition"] if hero == "BTN" else rule["outOfPosition"]
        return str(half_up(span["min"] * open_to))
    if skill_id == "D5":
        pot = int(re.search(r"The pot is (\d+)\.", prompt).group(1))
        return str(half_up(RULES["rules"]["D5"]["range"]["min"] * pot))
    raise ValueError(skill_id)


def check_ring(page: Page, skill_id: str, where: str) -> None:
    """The seat picture: 6 to 9 seats, one button, your seat (or the highlighted seat in A1)."""
    seats = page.locator(".ring .seat").count()
    if not 6 <= seats <= 9:
        problem(f"{where}: the table picture has {seats} seats")
    if page.locator(".ring .seat-button").count() != 1:
        problem(f"{where}: the table picture should have exactly one dealer button")
    if skill_id == "A1":
        if page.locator(".ring .seat--focus").count() != 1:
            problem(f"{where}: A1 should highlight one seat")
        names = [t.strip() for t in page.locator(".ring .seat-name").all_inner_texts()]
        if any(n not in ("", "?") for n in names):
            problem(f"{where}: A1 shows seat names {names}")
    elif skill_id == "A9" and page.locator(".ring .seat--you").count() == 0:
        if page.locator(".ring .seat--focus").count() != 1:
            problem(f"{where}: A9 should highlight a seat")
    elif page.locator(".ring .seat--you").count() != 1:
        problem(f"{where}: the table picture should highlight your seat once")


def check_draft_note(page: Page, skill_id: str, where: str) -> None:
    """The Draft advice note shows on advice from a draft content file, and nowhere else."""
    want = ADVICE_DRAFT.get(skill_id, False)
    has = page.locator(".draft-note").count() > 0
    if want and not has:
        problem(f"{where}: {skill_id} is draft advice but shows no Draft advice note")
    if has and not want:
        problem(f"{where}: {skill_id} shows a Draft advice note it should not have")


def practise_skill(page: Page, skill_id: str, prefix: str) -> None:
    """Open a skill, screenshot its explainer, then practise until one right and one wrong answer are saved."""
    open_tab(page, "Skills")
    page.get_by_text("Reading the board").wait_for()
    skill_row(page, skill_id).click()
    page.get_by_text("Worked example").wait_for()
    check_draft_note(page, skill_id, f"{skill_id} explainer")
    if skill_id in RING_SKILLS and page.locator(".example .ring").count() != 1:
        problem(f"{skill_id}: the worked example has no table picture")
    if skill_id in GRID_SKILLS and page.locator(".explainer .rg-cell").count() != 169:
        problem(f"{skill_id}: the worked example should show the 13 by 13 chart")
    shot(page, f"{prefix}-{skill_id}-skill-detail")
    click(page, "Practise")
    page.locator(".hud-info", has_text=skill_id).wait_for()
    got: set[str] = set()
    for attempt in range(18):
        page.locator(".prompt").wait_for()
        prompt = page.locator(".prompt").inner_text()
        if attempt == 0:
            if skill_id in RING_SKILLS:
                check_ring(page, skill_id, f"{skill_id} question")
            shot(page, f"{prefix}-{skill_id}-question")
            if skill_id == "C4":
                cards = page.locator(".choice .card").count()
                if cards != 8:
                    problem(f"C4 should show 8 mini cards in its choices, found {cards}")
        if skill_id == "D1":
            # Wrong on odd attempts: one chip is never inside the tolerance.
            if attempt % 2 == 0:
                number_answer(page, d1_answer(prompt))
            else:
                number_answer(page, "1")
        elif skill_id in ("D2", "D3", "D5"):
            number_answer(page, sizing_answer(page, skill_id, prompt) if attempt % 2 == 0 else "1")
        else:
            answer_any(page, attempt)
        outcome = wait_for_feedback(page)
        label = page.locator(".outs .lbl")
        if skill_id == "C4" and outcome == "correct" and (label.count() == 0 or "nuts" not in label.inner_text().lower()):
            problem("C4 feedback does not label the nuts")
        if skill_id in ("D2", "D3", "D5") and outcome != ("correct" if attempt % 2 == 0 else "wrong"):
            problem(f"{skill_id}: the answer worked out from the rules file was graded {outcome} on attempt {attempt}")
        check_draft_note(page, skill_id, f"{skill_id} feedback")
        if skill_id in GRID_SKILLS:
            if page.locator(".sheet .rg-cell").count() != 169 or page.locator(".sheet .rg-cell--yours").count() != 1:
                problem(f"{skill_id}: feedback should show the 13 by 13 chart with your hand outlined")
            if page.locator(".sheet .sources").count() != 1:
                problem(f"{skill_id}: feedback should name the source")
        if skill_id in ("D2", "D3", "D4", "D5") and page.locator(".sheet .sources").count() != 1:
            problem(f"{skill_id}: feedback should name the source")
        if outcome not in got:
            got.add(outcome)
            shot(page, f"{prefix}-{skill_id}-feedback-{outcome}")
        if len(got) == 2:
            break
        click(page, "Next question")
    if len(got) < 2:
        print(f"note: {skill_id} only showed {sorted(got)} feedback in 18 tries")
    click(page, "Done", exact=True)
    page.get_by_text("Next review").wait_for()
    click(page, "Back")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    chromium = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    if not chromium:
        sys.exit("No Chromium found under ~/.cache/ms-playwright")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium[0], args=["--no-sandbox"])

        def new_context(user_agent: str | None = None, mobile: bool = True):
            kwargs = dict(viewport=VIEWPORT, device_scale_factor=2, accept_downloads=True)
            if mobile:
                kwargs.update(is_mobile=True, has_touch=True)
            if user_agent:
                kwargs["user_agent"] = user_agent
            ctx = browser.new_context(**kwargs)
            ctx.add_init_script(FIXED_SEEDS_JS)
            return ctx

        def watch(page: Page) -> None:
            # The app must never talk to another server.
            page.on(
                "request",
                lambda r: None if r.url.startswith(("http://localhost:4173/", "data:", "blob:")) else problem("outside request: " + r.url),
            )
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(str(e)))

        # ---- A. Install screen on iPhone Safari, then continue in the browser ----
        ctx = new_context(IPHONE_UA)
        page = ctx.new_page()
        watch(page)
        page.goto(BASE)
        page.get_by_text("Add it to your Home Screen first").wait_for()
        shot(page, "01-install")
        page.get_by_role("button", name="Continue in the browser").click()
        page.get_by_text("Welcome").wait_for()
        if "read the board" not in page.locator(".panel--gold").first.inner_text():
            problem("the welcome text does not mention reading the board")
        shot(page, "02-home-first-run")

        # ---- B. First session: B1 is placed, then C1 (reading the board) is met ----
        click(page, "Start a 10-minute session")
        wait_tag(page, "New skill", "1 of 2")
        expect_tone(page, "blue", "new skill question")
        shot(page, "03-probe-question")
        page.locator("input[type=text]").fill("9")
        shot(page, "04-probe-number-filled")
        page.get_by_role("button", name="Check").click()
        shot(page, "05-probe-feedback-correct")
        click(page, "Next")
        wait_tag(page, "New skill", "2 of 2")
        number_answer(page, "9")
        page.get_by_text("You already know this one").wait_for()
        shot(page, "06-probe-placed")
        click(page, "Next")

        # The second new skill is C1, so a new player meets both areas in the first session.
        wait_tag(page, "New skill", "1 of 2")
        if page.locator(".choice").count() != 4:
            problem("the second new skill should be C1 with four hand-name choices")
        shot(page, "07-probe-choice-question")
        page.locator(".choice").nth(0).click()
        first = wait_for_feedback(page)
        label = page.locator(".outs .lbl")
        if label.count() == 0 or "best five" not in label.inner_text().lower():
            problem("C1 feedback does not show the best five cards")
        shot(page, f"08-probe-choice-feedback-{first}")
        click(page, "Next")
        wait_tag(page, "New skill", "2 of 2")
        page.locator(".choice").nth(1).click()
        second = wait_for_feedback(page)
        if first == "correct" and second == "correct":
            page.get_by_text("You already know this one").wait_for()
            shot(page, "09-probe-placed-C1")
            click(page, "Next")
        else:
            shot(page, f"09-probe-choice-feedback-{second}")
            click(page, "Next")
            page.get_by_text("Take a minute with this one").wait_for()
            shot(page, "10-explainer")
            click(page, "Start practice")
            for n in range(3):
                wait_tag(page, "New skill", "Practice")
                if n == 0:
                    shot(page, "11-practice-question")
                page.locator(".choice").nth(n % 4).click()
                outcome = wait_for_feedback(page)
                if n == 0:
                    shot(page, f"12-practice-feedback-{outcome}")
                click(page, "Next")
                if page.get_by_text("Session complete").count() > 0 or outcome == "correct":
                    break
        page.get_by_text("Session complete").wait_for()
        expect_tone(page, "purple", "summary")
        shot(page, "13-summary")
        click(page, "Done")
        page.get_by_text("Done for today").wait_for()
        page.get_by_text("Back up your progress").wait_for()
        shot(page, "14-home-done-export-banner")

        # ---- C. Skill map, detail, locked skill, extra practice ----
        open_tab(page, "Skills")
        page.get_by_text("Outs and pot odds").wait_for()
        for text in ["Reading the board", "Bet sizing", "Hands by seat"]:
            if page.get_by_text(text).count() == 0:
                problem(f"skill map is missing the area {text}")
        if page.get_by_text("Coming in a later update").count() != 0:
            problem("every area is live, but the skill map still says 'Coming in a later update'")
        for sid in SKILL_IDS:
            if skill_row(page, sid).count() != 1:
                problem(f"skill map has no row for {sid}")
        if skill_row(page, "A2").locator(".state").inner_text().strip().lower() != "locked":
            problem("A2 should be locked until A1 is met")
        shot(page, "15-skill-map")
        page.locator(".skill-row", has_text="Count outs: flush draw").click()
        shot(page, "16-skill-detail")
        click(page, "Back")
        page.locator(".skill-row", has_text="combination draws").click()
        shot(page, "17-skill-detail-locked")
        click(page, "Back")
        skill_row(page, "C4").click()
        shot(page, "18-skill-detail-C4-unlocked-by-C1")
        click(page, "Back")
        page.locator(".skill-row", has_text="Count outs: flush draw").click()
        click(page, "Practise")
        page.locator(".hud-info", has_text="B1").wait_for()
        shot(page, "19-practice-question")
        number_answer(page, "9")
        page.get_by_text("Right!").first.wait_for()
        shot(page, "20-practice-feedback")
        click(page, "Done", exact=True)
        page.get_by_text("Next review").wait_for()

        # ---- D. Settings, export, reset, import ----
        open_tab(page, "Settings")
        page.get_by_text("Session length").wait_for()
        shot(page, "18-settings")
        page.get_by_role("button", name="15 min").click()
        page.get_by_role("button", name="3", exact=True).click()
        page.get_by_role("button", name="10 min").click()
        page.get_by_role("button", name="2", exact=True).click()

        # The animated background switch is on by default, saves with the settings and goes into backups.
        switch = page.get_by_role("switch", name="Animated background")
        if switch.get_attribute("aria-checked") != "true":
            problem("the animated background switch should start on")
        switch.click()
        page.wait_for_timeout(400)  # the setting is saved and reloaded first
        if switch.get_attribute("aria-checked") != "false":
            problem("the animated background switch did not turn off")
        shot(page, "18-settings-background-off")

        before = dump_db(page)
        if before["meta"]["settings"].get("animatedBackground") is not False:
            problem("the animated background setting was not saved")
        with page.expect_download() as download:
            click(page, "Export progress")
        backup_path = OUT / "backup.json"
        download.value.save_as(str(backup_path))
        print("downloaded", download.value.suggested_filename)
        if not re.fullmatch(r"pokerlingo-backup-\d{4}-\d{2}-\d{2}\.json", download.value.suggested_filename):
            problem("backup file name is wrong: " + download.value.suggested_filename)
        page.get_by_text("Backup downloaded").wait_for()
        before = dump_db(page)  # lastExportAt is set now
        shot(page, "19-settings-after-export")

        click(page, "Reset progress")
        page.get_by_text("Erase all progress?").wait_for()
        shot(page, "20-reset-dialog")
        click(page, "Erase everything")
        page.get_by_text("Progress erased").wait_for()
        wiped = dump_db(page)
        if wiped["skillStates"] or wiped["reviewLogs"] or wiped["sessions"]:
            problem("reset left data behind")
        shot(page, "21-settings-after-reset")

        page.locator("input[type=file]").set_input_files(str(backup_path))
        page.get_by_text("Replace your progress?").wait_for()
        shot(page, "22-import-dialog")
        click(page, "Replace with this backup")
        page.get_by_text("Backup restored").wait_for()
        shot(page, "23-settings-after-import")
        after = dump_db(page)
        if json.dumps(before, sort_keys=True) != json.dumps(after, sort_keys=True):
            problem("export then import did not restore identical data")
            (OUT / "before.json").write_text(json.dumps(before, indent=1, sort_keys=True))
            (OUT / "after.json").write_text(json.dumps(after, indent=1, sort_keys=True))
        else:
            print("export then import: identical data")

        # A bad file is rejected without changing anything.
        bad = OUT / "bad.json"
        bad.write_text('{"app":"other"}')
        page.locator("input[type=file]").set_input_files(str(bad))
        page.get_by_text("not a pokerlingo backup").wait_for()
        shot(page, "24-import-rejected")
        if json.dumps(dump_db(page), sort_keys=True) != json.dumps(after, sort_keys=True):
            problem("a rejected import changed the data")

        # ---- E. Progress survives a reload ----
        page.reload()
        page.get_by_text("Done for today").wait_for()  # a reload starts on Home
        if json.dumps(dump_db(page), sort_keys=True) != json.dumps(after, sort_keys=True):
            problem("data changed across a reload")
        print("progress survives a reload")
        open_tab(page, "Settings")
        switch = page.get_by_role("switch", name="Animated background")
        if switch.get_attribute("aria-checked") != "false":
            problem("the animated background setting did not survive the import and a reload")
        switch.click()
        page.wait_for_timeout(400)
        if dump_db(page)["meta"]["settings"].get("animatedBackground") is not True:
            problem("the animated background setting did not turn back on")
        open_tab(page, "Today")
        page.get_by_text("Done for today").wait_for()

        # ---- F. Every new skill: explainer, question, right and wrong feedback ----
        # Seeding all 29 skills as introduced unlocks the lot, so each can be practised.
        page.evaluate(SEED_DUE_JS)
        page.reload()
        page.get_by_text("still due will roll over").wait_for()
        shot(page, "25-home-reviews-due")
        for sid in ["C1", "C2", "C3", "C4", "C5", "C6", "D1"]:
            practise_skill(page, sid, "26")
        # Areas A and D: the explainer, a question, and right and wrong feedback for every skill.
        for sid in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "D2", "D3", "D4", "D5"]:
            practise_skill(page, sid, "27")
        open_tab(page, "Today")
        page.get_by_text("still due will roll over").wait_for()

        # ---- F2. A review session over all 16 skills ----
        click(page, "Start another session")
        seen: dict[str, int] = {}
        for i in range(1, 121):
            page.locator(".prompt").wait_for()
            tmp = OUT / f"_q{i}.png"
            settle(page, 100)
            for item in page.evaluate(CHECK_LAYOUT_JS):
                problem(f"review {i} question: {item}")
            for item in page.evaluate(TAP_TARGETS_JS):
                problem(f"review {i} question: small tap target: {item}")
            page.screenshot(path=str(tmp), full_page=True)
            is_choice = page.locator(".choice").count() > 0
            if is_choice:
                page.locator(".choice").nth(i % 2).click()
            else:
                number_answer(page, "1")
            page.get_by_text("Skill: ").wait_for()
            settle(page, 100)  # the sheet slides up
            skill = re.search(r"Skill: ([A-D]\d)", page.get_by_text("Skill: ").inner_text()).group(1)
            box = page.get_by_role("button", name=re.compile("^(Next|Finish session)$")).bounding_box()
            if box is None or box["y"] + box["height"] > VIEWPORT["height"] + 1:
                problem(f"review {i} ({skill}): the Next button is below the fold: {box}")
                page.screenshot(path=str(OUT / f"_fold-{i}-{skill}.png"))  # what the phone shows, not the full page
            seen[skill] = seen.get(skill, 0) + 1
            label = f"{seen[skill]}"
            if seen[skill] <= 2:  # keep the first question and its retry for each skill
                tmp.rename(OUT / f"30-review-{skill}-{label}-question.png")
                shot(page, f"30-review-{skill}-{label}-feedback")
            else:
                tmp.unlink()
            if i == 6:
                page.locator(".hud").get_by_role("button", name="End").click()
                page.get_by_text("End this session?").wait_for()
                shot(page, "31-end-dialog")
                click(page, "Keep going")
            if len(seen) == len(SKILL_IDS):
                break
            click(page, "Next")
        if len(seen) < len(SKILL_IDS):
            problem(f"only saw skills {sorted(seen)} in the review run after {i} questions")
        page.locator(".hud").get_by_role("button", name="End").click()
        page.get_by_text("End this session?").wait_for()
        click(page, "End session")
        page.get_by_text("Session ended early").wait_for()
        shot(page, "32-summary-ended-early")
        click(page, "Done")

        # ---- F3. A player who had the first 16 skills meets Area A in a session ----
        page.evaluate(INTRO_SEED_JS)
        page.reload()
        page.get_by_role("button", name=re.compile("^Start")).wait_for()
        click(page, "Start")
        explained = 0
        for step in range(60):
            page.locator(".prompt, :text('Take a minute with this one'), :text('Session complete')").first.wait_for()
            if page.get_by_text("Session complete").count() > 0:
                break
            if page.get_by_text("Take a minute with this one").count() > 0:
                title = page.locator("h1").first.inner_text()
                explained += 1
                check_draft_note(page, "A1" if title.startswith("Name the seats") else "A2", "in-session explainer")
                shot(page, f"28-intro-explainer-{explained}")
                click(page, "Start practice")
                continue
            if step < 3:
                check_ring(page, "A1" if page.locator(".ring .seat--focus").count() == 1 else "A2", "intro question")
                shot(page, f"28-intro-question-{step}")
            if page.locator(".choice").count() > 0:
                page.locator(".choice").nth(step % 2).click()
            else:
                number_answer(page, "1")
            wait_for_feedback(page)
            if step < 3:
                shot(page, f"28-intro-feedback-{step}")
            click(page, re.compile("^(Next|Finish session)$"))
        else:
            problem("the Area A introduction session did not finish in 60 steps")
        page.get_by_text("Session complete").wait_for()
        click(page, "Done")
        page.get_by_role("button", name=re.compile("^Start|Skill map")).first.wait_for()

        # ---- G. Timer states with a fake clock ----
        page.evaluate(SEED_DUE_JS)  # the review run above rescheduled everything
        page2 = ctx.new_page()
        watch(page2)
        page2.clock.install()
        page2.clock.resume()  # time flows as normal until we jump it
        page2.goto(BASE)
        page2.get_by_role("button", name="Continue in the browser").click()  # a new tab asks again
        page2.get_by_text("still due will roll over").wait_for()
        page2.get_by_role("button", name=re.compile("Start")).click()
        page2.locator(".prompt").wait_for()
        expect_tone(page2, "green", "review question")
        shot(page2, "33-timer-full")
        page2.clock.run_for(9 * 60 * 1000 + 20_000)
        page2.wait_for_timeout(500)
        expect_tone(page2, "red", "under one minute")
        shot(page2, "34-timer-low")
        page2.clock.run_for(2 * 60 * 1000)
        page2.wait_for_timeout(500)
        page2.get_by_text("Time is up").wait_for()
        shot(page2, "35-timer-up")
        if page2.locator(".choice").count() > 0:
            page2.locator(".choice").first.click()
        else:
            number_answer(page2, "1")
        page2.get_by_role("button", name="Finish session").wait_for()
        shot(page2, "36-timer-up-feedback")
        page2.get_by_role("button", name="Finish session").click()
        page2.get_by_text("Session complete").wait_for()
        shot(page2, "37-summary-timer")
        page2.close()

        # ---- H. Offline start ----
        page.reload()
        page.evaluate("navigator.serviceWorker.ready.then(() => true)")
        page.wait_for_timeout(1000)
        page.reload()  # now controlled by the service worker
        page.wait_for_timeout(500)
        ctx.set_offline(True)
        page.reload()
        page.get_by_text("pokerlingo").first.wait_for()
        open_tab(page, "Skills")
        page.get_by_text("Outs and pot odds").wait_for()
        shot(page, "38-offline-skill-map")
        ctx.set_offline(False)
        print("offline start works")
        ctx.close()

        # ---- I. Desktop user agent has no install screen ----
        ctx2 = new_context(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
            mobile=False,
        )
        page3 = ctx2.new_page()
        watch(page3)
        page3.goto(BASE)
        page3.get_by_text("Welcome").wait_for()
        if page3.get_by_text("Add it to your Home Screen first").count() > 0:
            problem("install screen shown on a desktop browser")
        ctx2.close()
        browser.close()

    real_errors = [e for e in console_errors if "favicon" not in e]
    for e in real_errors:
        problem("console error: " + e)

    print()
    if problems:
        print(f"{len(problems)} problem(s):")
        for m in problems:
            print(" -", m)
        sys.exit(1)
    print("No layout problems, console errors or data problems found.")


if __name__ == "__main__":
    main()
