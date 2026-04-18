async function(page) {
  return await page.locator('.cm-editor').evaluate((el) => ({
    html: el.outerHTML.slice(0, 4000),
  }));
}
