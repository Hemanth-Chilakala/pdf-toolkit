let currentStep = 1;
const listeners = new Set();

export function resetToolFlow() {
  setToolStep(1);
}

export function setToolStep(step) {
  currentStep = Math.min(3, Math.max(1, step));
  listeners.forEach((fn) => fn(currentStep));
}

export function onToolStepChange(fn) {
  listeners.add(fn);
  fn(currentStep);
  return () => listeners.delete(fn);
}

export function markConfigured() {
  if (currentStep < 2) setToolStep(2);
}

export function markComplete() {
  setToolStep(3);
}