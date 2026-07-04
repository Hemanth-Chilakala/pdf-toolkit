import './style.css';
import { createApp } from './app.js';

if (location.protocol === 'file:') {
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:4rem auto;padding:2rem;color:#e8eaed;background:#12151c;border:1px solid #2a3142;border-radius:12px;line-height:1.6">
        <h1 style="margin:0 0 0.75rem;font-size:1.5rem;color:#fff">PDF Toolkit</h1>
        <p style="margin:0 0 1rem;color:#9aa3b5">This app cannot run by double-clicking <code style="color:#ef5a5a">index.html</code>. Browsers block local apps for security.</p>
        <p style="margin:0 0 0.75rem;color:#9aa3b5">Open a terminal in this folder and run:</p>
        <pre style="margin:0 0 1rem;padding:1rem;background:#090b10;border-radius:8px;color:#c8d0e0;overflow:auto">npm install
npm start</pre>
        <p style="margin:0;color:#9aa3b5">Then open the URL printed in the terminal (usually <strong style="color:#fff">http://localhost:5174</strong>)</p>
      </div>`;
  }
} else {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app element');
  createApp(root);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}