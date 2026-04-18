async function(page) {
  return await page.locator('.cm-content[role="textbox"]').evaluate((el) => ({
    contenteditable: el.getAttribute('contenteditable'),
    hasCmView: Boolean(el.cmView),
    hasParentView: Boolean(el.closest('.cm-editor')?.cmView),
    text: el.textContent,
  }));
}
