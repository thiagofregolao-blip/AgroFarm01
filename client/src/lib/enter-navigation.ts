/**
 * Utility: press Enter in a form input to jump to the next focusable field.
 * Attach to a <form> onKeyDown or individual <input> onKeyDown.
 */
export function onEnterNext(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    // Don't intercept Enter on textareas or buttons
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    // Don't intercept if it's a submit button
    if ((target as HTMLInputElement).type === "submit") return;

    const container = target.closest("form, [role='dialog']") as HTMLElement | null;
    if (!container) return;

    const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]), ' +
            'select:not([disabled]), ' +
            'textarea:not([disabled]), ' +
            'button[type="submit"]:not([disabled])'
        )
    );

    const idx = focusable.indexOf(target);
    if (idx >= 0 && idx < focusable.length - 1) {
        e.preventDefault();
        focusable[idx + 1].focus();
    }
}
