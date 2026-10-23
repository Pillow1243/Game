import './style.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const app = document.querySelector<HTMLElement>('#app');
if (app) app.dataset.ready = 'true';
