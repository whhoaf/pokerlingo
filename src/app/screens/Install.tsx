interface Props {
  onContinue(): void;
}

/** Shown first on iOS Safari, so progress lands in the Home Screen app and not in a Safari tab. */
export function InstallScreen({ onContinue }: Props) {
  return (
    <div class="screen">
      <div class="hero">
        <img class="logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="72" height="72" />
        <h1 class="title">pokerlingo</h1>
      </div>

      <div class="panel">
        <p>Learn casual Texas Hold'em in 10 minutes a day.</p>
      </div>

      <div class="panel panel--gold stack">
        <h2>Add it to your Home Screen first</h2>
        <p>
          Safari deletes a website's saved data after 7 days without a visit. A Home Screen app keeps its own storage, so
          your progress stays safe.
        </p>
      </div>

      <ol class="panel steps">
        <li>
          Tap the <strong>Share</strong> button in Safari. It is the square with an arrow pointing up.
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong>Add</strong>, then open pokerlingo from your Home Screen.
        </li>
      </ol>

      <div class="actions">
        <p class="panel small">
          You can carry on in the browser, but anything you learn here will not carry over to the Home Screen app.
        </p>
        <button type="button" class="btn btn--dark" onClick={onContinue}>
          Continue in the browser
        </button>
      </div>
    </div>
  );
}
