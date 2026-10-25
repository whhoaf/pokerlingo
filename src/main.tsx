import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './app/styles.css';
import { openDb } from './storage/db';

async function boot(root: HTMLElement) {
  try {
    const db = await openDb();
    // Ask the browser not to evict our data. It is fine if this is refused.
    void navigator.storage?.persist?.();
    render(<App db={db} />, root);
  } catch (e) {
    console.error(e);
    render(
      <div class="screen">
        <h1>pokerlingo</h1>
        <div class="message message--error">
          Storage is not available in this browser, so progress cannot be saved. Private browsing can cause this. Try a normal
          window.
        </div>
      </div>,
      root,
    );
  }
}

void boot(document.getElementById('app')!);

// Offline support: the service worker updates itself and the app reloads on the next visit.
registerSW({ immediate: true });
