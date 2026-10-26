"""Offline and backup check, in Chromium.

Start the preview server first:   npx vite preview --port 4173
Then run:  /home/hermes/venvs/scrape/bin/python scripts/offline_check.py

1. Load the app once online (this installs the service worker and fills the cache) and finish a first session.
2. Seed every skill as met and due, so a review session mixes all four areas.
3. Go offline, reload, and check that the pixel font still loads from the cache.
4. Play a whole session offline until it has asked an Area A and an Area D question, run the clock out, and finish.
5. Still offline, export a backup.
6. Go online, clear all site storage (IndexedDB, caches, service workers), reload, import the backup, and check that
   progress and settings are back, identical to before.
The app must make no request outside localhost:4173 at any point.
"""

from __future__ import annotations

import glob
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from screenshots import (
    BASE,
    SEED_DUE_JS,
    VIEWPORT,
    click,
    dump_db,
    number_answer,
    open_tab,
    wait_for_feedback,
)

OUT = Path(__file__).resolve().parent.parent / "screenshots"
problems: list[str] = []


def problem(msg: str) -> None:
    problems.append(msg)
    print("PROBLEM:", msg)


FONT_JS = """
async () => {
  await document.fonts.ready;
  const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'm6x11plus');
  return { faces: faces.map((f) => f.status), check: document.fonts.check('18px m6x11plus') };
}
"""


def font_report(page: Page, where: str) -> None:
    """The pixel font must be loaded, and a pixel label must really be drawn with it."""
    report = page.evaluate(FONT_JS)
    if not report["faces"] or any(s != "loaded" for s in report["faces"]) or not report["check"]:
        problem(f"{where}: the pixel font is not loaded: {report}")
    family = page.evaluate("() => getComputedStyle(document.querySelector('.btn')).fontFamily")
    if "m6x11plus" not in family:
        problem(f"{where}: buttons do not use the pixel font: {family}")


def answer_here(page: Page, i: int) -> None:
    choices = page.locator(".choice")
    if choices.count() > 0:
        choices.nth(i % choices.count()).click()
    else:
        number_answer(page, "1")


def first_session(page: Page) -> None:
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
        answer_here(page, 0)
        wait_for_feedback(page)
        click(page, re.compile("^(Next|Finish session)$"))
    page.get_by_text("Session complete").wait_for()
    click(page, "Done")
    page.get_by_text("Done for today").wait_for()


def main() -> None:
    OUT.mkdir(exist_ok=True)
    chromium = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome")))
    if not chromium:
        sys.exit("No Chromium found under ~/.cache/ms-playwright")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium[0], args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport=VIEWPORT, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True
        )
        page = ctx.new_page()
        page.on(
            "request",
            lambda r: None if r.url.startswith(("http://localhost:4173/", "data:", "blob:")) else problem("outside request: " + r.url),
        )
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- 1 and 2. Online: first session, then every skill met and due ----
        first_session(page)
        font_report(page, "online")
        page.evaluate(SEED_DUE_JS)
        page.evaluate("navigator.serviceWorker.ready.then(() => true)")
        page.reload()
        page.wait_for_timeout(1000)
        page.reload()  # now controlled by the service worker
        page.get_by_text("still due will roll over").wait_for()
        if not page.evaluate("() => !!navigator.serviceWorker.controller"):
            problem("the service worker does not control the page after two loads")

        # Settings that must survive the round trip.
        open_tab(page, "Settings")
        page.get_by_text("Session length").wait_for()
        page.get_by_role("button", name="15 min").click()
        page.get_by_role("button", name="3", exact=True).click()
        switch = page.get_by_role("switch", name="Animated background")
        switch.click()
        page.wait_for_timeout(400)
        open_tab(page, "Today")
        page.get_by_text("still due will roll over").wait_for()

        # ---- 3. Offline: the font comes from the cache ----
        ctx.set_offline(True)
        page.reload()
        page.get_by_text("still due will roll over").wait_for()
        font_report(page, "offline after reload")
        page.screenshot(path=str(OUT / "40-offline-home.png"))

        # ---- 4. A whole session offline, with an Area A and an Area D question ----
        page.clock.install()
        page.clock.resume()
        page.reload()
        page.get_by_text("still due will roll over").wait_for()
        click(page, re.compile("^Start"))
        seen: set[str] = set()
        for i in range(120):
            page.locator(".prompt, :text('Take a minute with this one')").first.wait_for()
            if page.get_by_text("Take a minute with this one").count() > 0:
                click(page, "Start practice")
                continue
            area = page.locator(".hud .tag b").inner_text().strip()
            if area in ("Seats", "Sizing") and area not in seen:
                seen.add(area)
                font_report(page, f"offline {area} question")
                page.screenshot(path=str(OUT / f"41-offline-{area.lower()}-question.png"))
            if seen == {"Seats", "Sizing"}:
                break
            answer_here(page, i)
            wait_for_feedback(page)
            click(page, re.compile("^(Next|Finish session)$"))
        if seen != {"Seats", "Sizing"}:
            problem(f"the offline session did not ask both an Area A and an Area D question, saw {sorted(seen)}")
        # Run the clock out. The question on screen finishes first, then the session ends.
        page.clock.run_for(16 * 60 * 1000)  # the session is 15 minutes here
        page.get_by_text("Time is up").wait_for()
        answer_here(page, 0)
        wait_for_feedback(page)
        click(page, "Finish session")
        page.get_by_text("Session complete").wait_for()
        font_report(page, "offline summary")
        page.screenshot(path=str(OUT / "42-offline-summary.png"))
        click(page, "Done")
        page.get_by_text("Done for today").wait_for()
        print("a whole session works offline, with an Area A and an Area D question")

        # ---- 5. Export, still offline ----
        open_tab(page, "Settings")
        page.get_by_text("Session length").wait_for()
        with page.expect_download() as download:
            click(page, "Export progress")
        backup = OUT / "offline-backup.json"
        download.value.save_as(str(backup))
        page.get_by_text("Backup downloaded").wait_for()
        before = dump_db(page)
        print("exported", download.value.suggested_filename)
        if not before["skillStates"] or not before["reviewLogs"] or not before["sessions"]:
            problem("there was no progress to back up")
        if before["meta"]["settings"].get("animatedBackground") is not False:
            problem("the animated background setting was not saved before the export")

        # ---- 6. Online again: clear every kind of site storage, then import ----
        ctx.set_offline(False)
        cdp = ctx.new_cdp_session(page)
        cdp.send("Storage.clearDataForOrigin", {"origin": "http://localhost:4173", "storageTypes": "all"})
        page.goto("about:blank")
        page.goto(BASE)
        page.get_by_text("Welcome").wait_for()  # a fresh player
        wiped = dump_db(page)
        if wiped["skillStates"] or wiped["reviewLogs"] or wiped["sessions"]:
            problem("clearing site storage left progress behind")
        open_tab(page, "Settings")
        page.get_by_text("Session length").wait_for()
        page.locator("input[type=file]").set_input_files(str(backup))
        page.get_by_text("Replace your progress?").wait_for()
        click(page, "Replace with this backup")
        page.get_by_text("Backup restored").wait_for()
        page.reload()
        after = dump_db(page)
        if json.dumps(before, sort_keys=True) != json.dumps(after, sort_keys=True):
            problem("the data after import is not identical to the data before the export")
            (OUT / "offline-before.json").write_text(json.dumps(before, indent=1, sort_keys=True))
            (OUT / "offline-after.json").write_text(json.dumps(after, indent=1, sort_keys=True))
        else:
            print(
                f"import restored {len(after['skillStates'])} skills, {len(after['reviewLogs'])} reviews, "
                f"{len(after['sessions'])} sessions and the settings, identical to before"
            )
        open_tab(page, "Settings")
        page.get_by_text("Session length").wait_for()
        pressed = [b.inner_text().strip() for b in page.locator("button[aria-pressed=true]").all()]
        if "15 min" not in pressed or "3" not in pressed:
            problem(f"settings screen after import shows {pressed}, expected 15 min and 3")
        if page.get_by_role("switch", name="Animated background").get_attribute("aria-checked") != "false":
            problem("the animated background switch is not off after import")
        page.screenshot(path=str(OUT / "43-settings-after-import.png"))
        for e in errors:
            problem("page error: " + e)
        browser.close()

    print()
    if problems:
        print(f"{len(problems)} problem(s)")
        sys.exit(1)
    print("Offline and backup checks passed.")


if __name__ == "__main__":
    main()
