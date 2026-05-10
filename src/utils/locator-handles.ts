import type { ElementHandle, Locator } from '@playwright/test';

export async function getImmediateElementHandle(locator: Locator): Promise<ElementHandle<HTMLElement | SVGElement> | null> {
  const handles = await locator.elementHandles().catch(() => []);
  return (handles[0] as ElementHandle<HTMLElement | SVGElement> | undefined) ?? null;
}
