import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CoreApp } from './engine/app';

registerSW({ immediate: true });

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('CORE: application root is missing from the document.');

const app = new CoreApp(root);
app.start().catch((error: unknown) => {
  console.error('CORE: engine startup failed.', error);
  const screen = document.createElement('section');
  screen.className = 'startup-error';
  const label = document.createElement('span');
  label.textContent = 'CORE / ENGINE FAILURE';
  const title = document.createElement('h1');
  title.textContent = 'Graphics initialization failed';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'A required graphics feature is not available.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'RELOAD SIMULATOR';
  retry.addEventListener('click', () => window.location.reload());
  screen.append(label, title, message, retry);
  root.replaceChildren(screen);
});
