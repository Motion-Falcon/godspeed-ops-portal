/**
 * Utility function to make a table row clickable when it contains a view button.
 * Returns props that should be spread on the <tr> element.
 * 
 * @param viewActionHandler - The function to call when the row is clicked (same as view button onClick)
 * @returns Object with row props to spread on the <tr> element, or empty object if no handler provided
 */
export function getClickableRowProps(viewActionHandler: (() => void) | null | undefined) {
  if (!viewActionHandler) {
    return {};
  }

  return {
    className: 'clickable-row',
    onClick: (e: React.MouseEvent<HTMLTableRowElement>) => {
      // Don't trigger if clicking on a button, input, select, or link
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('a')
      ) {
        return;
      }
      viewActionHandler();
    },
  };
}
