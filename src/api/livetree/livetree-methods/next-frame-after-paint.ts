
export function nextFrame(): Promise<void> {
  // resolves right before the next paint
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export async function after_paint(): Promise<void> {
  // ensures at least one paint between awaits
  await nextFrame();
  await nextFrame();
}
