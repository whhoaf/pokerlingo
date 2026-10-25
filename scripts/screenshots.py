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


def shot(page: Page, name: str) -> None:
    page.wait_for_timeout(150)
    for item in page.evaluate(CHECK_LAYOUT_JS):
        problem(f"{name}: {item}")
    for item in page.evaluate(TAP_TARGETS_JS):
        problem(f"{name}: small tap target: {item}")
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    print("saved", name)


def number_answer(page: Page, value: str) -> None:
    page.locator("input[type=text]").fill(value)
    page.get_by_role("button", name="Check").click()


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
  const ids = ['B1','B2','B3','B4','B5','B6','B7','B8','B9'];
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
"""


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
            return ctx

        def watch(page: Page) -> None:
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
        shot(page, "02-home-first-run")

        # ---- B. First session: placement, then a skill that needs teaching ----
        click(page, "Start a 10-minute session")
        page.get_by_text("New skill, question 1 of 2").wait_for()
        shot(page, "03-probe-question")
        page.locator("input[type=text]").fill("9")
        shot(page, "04-probe-number-filled")
        page.get_by_role("button", name="Check").click()
        shot(page, "05-probe-feedback-correct")
        click(page, "Next")
        page.get_by_text("New skill, question 2 of 2").wait_for()
        number_answer(page, "9")
        page.get_by_text("You already know this one").wait_for()
        shot(page, "06-probe-placed")
        click(page, "Next")
        page.get_by_text("New skill, question 1 of 2").wait_for()
        number_answer(page, "1")
        page.get_by_text("Not quite").wait_for()
        shot(page, "07-probe-feedback-wrong")
        click(page, "Next")
        number_answer(page, "1")
        click(page, "Next")
        page.get_by_text("Take a minute with this one").wait_for()
        shot(page, "08-explainer")
        click(page, "Start practice")
        page.get_by_text("New skill, practice").wait_for()
        shot(page, "09-practice-question")
        number_answer(page, "8")
        page.get_by_text("Correct").first.wait_for()
        shot(page, "10-practice-feedback")
        click(page, "Next")
        page.get_by_text("Session complete").wait_for()
        shot(page, "11-summary")
        click(page, "Done")
        page.get_by_text("Done for today").wait_for()
        page.get_by_text("Back up your progress").wait_for()
        shot(page, "12-home-done-export-banner")

        # ---- C. Skill map, detail, locked skill, extra practice ----
        page.locator(".tab", has_text="Skills").click()
        page.get_by_text("Outs and pot odds").wait_for()
        shot(page, "13-skill-map")
        page.locator(".skill-row", has_text="Count outs: flush draw").click()
        shot(page, "14-skill-detail")
        click(page, "Back")
        page.locator(".skill-row", has_text="combination draws").click()
        shot(page, "15-skill-detail-locked")
        click(page, "Back")
        page.locator(".skill-row", has_text="Count outs: flush draw").click()
        click(page, "Practise")
        page.get_by_text("Practice, B1").wait_for()
        shot(page, "16-practice-question")
        number_answer(page, "9")
        page.get_by_text("Correct").first.wait_for()
        shot(page, "17-practice-feedback")
        click(page, "Done", exact=True)
        page.get_by_text("Next review").wait_for()

        # ---- D. Settings, export, reset, import ----
        page.locator(".tab", has_text="Settings").click()
        page.get_by_text("Session length").wait_for()
        shot(page, "18-settings")
        page.get_by_role("button", name="15 min").click()
        page.get_by_role("button", name="3", exact=True).click()
        page.get_by_role("button", name="10 min").click()
        page.get_by_role("button", name="2", exact=True).click()

        before = dump_db(page)
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

        # ---- F. Reviews for all nine skills ----
        page.evaluate(SEED_DUE_JS)
        page.reload()
        page.get_by_text("still due will roll over").wait_for()
        shot(page, "25-home-reviews-due")
        click(page, "Start another session")
        seen: dict[str, int] = {}
        for i in range(1, 46):
            page.locator(".prompt").wait_for()
            tmp = OUT / f"_q{i}.png"
            page.wait_for_timeout(100)
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
            page.wait_for_timeout(100)
            box = page.get_by_role("button", name=re.compile("^(Next|Finish session)$")).bounding_box()
            if box is None or box["y"] + box["height"] > VIEWPORT["height"] + 1:
                problem(f"review {i}: the Next button is below the fold: {box}")
            skill =re.search(r"Skill: (B\d)", page.get_by_text("Skill: ").inner_text()).group(1)
            seen[skill] = seen.get(skill, 0) + 1
            label = f"{seen[skill]}"
            if seen[skill] <= 2:  # keep the first question and its retry for each skill
                tmp.rename(OUT / f"30-review-{skill}-{label}-question.png")
                shot(page, f"30-review-{skill}-{label}-feedback")
            else:
                tmp.unlink()
            if i == 6:
                page.locator(".session-top").get_by_role("button", name="End").click()
                page.get_by_text("End this session?").wait_for()
                shot(page, "31-end-dialog")
                click(page, "Keep going")
            if len(seen) == 9 and all(n >= 1 for n in seen.values()):
                break
            click(page, "Next")
        if len(seen) < 9:
            problem(f"only saw skills {sorted(seen)} in the review run after {i} questions")
        page.locator(".session-top").get_by_role("button", name="End").click()
        page.get_by_text("End this session?").wait_for()
        click(page, "End session")
        page.get_by_text("Session ended early").wait_for()
        shot(page, "32-summary-ended-early")
        click(page, "Done")

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
        shot(page2, "33-timer-full")
        page2.clock.run_for(9 * 60 * 1000 + 20_000)
        page2.wait_for_timeout(500)
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
        page.locator(".tab", has_text="Skills").click()
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
