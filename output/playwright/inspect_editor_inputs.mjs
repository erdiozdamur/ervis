async function(page) {
  return await page.locator('.cm-editor').evaluate((el) => Array.from(el.querySelectorAll('*')).map((n) => ({tag:n.tagName, cls:n.className, role:n.getAttribute('role'), contenteditable:n.getAttribute('contenteditable'), aria:n.getAttribute('aria-hidden')})).filter((x) => ['TEXTAREA','INPUT'].includes(x.tag) || x.contenteditable === 'true').slice(0,50));
}
