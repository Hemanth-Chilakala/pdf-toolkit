import { PDFDocument, loadPdfDocument, downloadBytes } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';

export function renderProtect(container) {
  let pdfData = null;

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
      renderUI();
    } catch (err) {
      showToast(err.message || 'Could not load PDF', 'error');
    }
  }));

  const workspace = el('div', 'hidden');
  container.appendChild(workspace);

  function renderUI() {
    if (!pdfData) return;
    workspace.classList.remove('hidden');

    workspace.innerHTML = `
      <div class="card">
        <div class="card-title">Password Protect ${escapeHtml(pdfData.file.name)}</div>
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:1rem">
          Encrypts your PDF with AES-256. You'll need the password to open the file.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label>User Password (required to open)</label>
            <input type="password" id="user-pass" placeholder="Enter password" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="user-pass-confirm" placeholder="Re-enter password" autocomplete="new-password" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Owner Password (optional, for permissions)</label>
            <input type="password" id="owner-pass" placeholder="Optional" autocomplete="new-password" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>
              <input type="checkbox" id="allow-print" checked /> Allow printing
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="allow-copy" /> Allow copying text
            </label>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="protect-btn">Protect & Download</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Security Info</div>
        <ul class="info-list">
          <li>Encryption happens locally in your browser using AES-256.</li>
          <li>Your password is never transmitted or stored anywhere.</li>
          <li>Remember your password — it cannot be recovered.</li>
        </ul>
      </div>
    `;

    workspace.querySelector('#protect-btn').addEventListener('click', async () => {
      const userPass = workspace.querySelector('#user-pass').value;
      const confirmPass = workspace.querySelector('#user-pass-confirm').value;
      const ownerPass = workspace.querySelector('#owner-pass').value || userPass;

      if (!userPass || userPass.length < 4) {
        showToast('Password must be at least 4 characters', 'error');
        return;
      }
      if (userPass !== confirmPass) {
        showToast('Passwords do not match', 'error');
        return;
      }

      await runWithProgress(async () => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const result = await doc.save({
          userPassword: userPass,
          ownerPassword: ownerPass,
          permissions: {
            printing: workspace.querySelector('#allow-print').checked ? 'highResolution' : 'none',
            copying: workspace.querySelector('#allow-copy').checked,
            modifying: false,
          },
        });
        downloadBytes(result, 'protected.pdf');
        showToast('PDF protected with AES encryption!');
      }, 'Encrypting PDF...');
    });
  }
}