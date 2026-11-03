export function element(id: string): HTMLElement {
  const result = document.querySelector<HTMLElement>(`#${id}`);
  if (!result) {
    throw new Error(`Missing element #${id}`);
  }
  return result;
}

export function input(id: string): HTMLInputElement {
  const result = element(id);
  if (!(result instanceof HTMLInputElement)) {
    throw new TypeError(`Expected input #${id}`);
  }
  return result;
}

export function button(id: string): HTMLButtonElement {
  const result = element(id);
  if (!(result instanceof HTMLButtonElement)) {
    throw new TypeError(`Expected button #${id}`);
  }
  return result;
}

export function select(id: string): HTMLSelectElement {
  const result = element(id);
  if (!(result instanceof HTMLSelectElement)) {
    throw new TypeError(`Expected select #${id}`);
  }
  return result;
}
