async function(page) {
  const content = "APP_ENV=production\nOPENAI_API_KEY=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\nJWT_SECRET_KEY=cdd14c4a5870dca82554dab40ca7a8ae15bb77b89148b4faf7d7426a5ed79af0\nPOSTGRES_PASSWORD=d24d67dfe47a446220b0465586bbe60f\nPOSTGRES_USER=ervis\nPOSTGRES_DB=ervis_core\nPOSTGRES_HOST_PORT=5544\nBACKEND_HOST_PORT=0\nFRONTEND_HOST_PORT=0\nAPP_NAME=ervis-prod\nAPP_DOMAIN=er-di.info\nDOKPLOY_NETWORK_NAME=dokploy-network\nAUTH_SECRET=f3078c02c108dad808ede82136871c163daf097d4814a1c242696bd0e57b9ed1\nNEXTAUTH_SECRET=f3078c02c108dad808ede82136871c163daf097d4814a1c242696bd0e57b9ed1\nNEXTAUTH_URL=https://er-di.info\nNEXT_PUBLIC_APP_URL=https://er-di.info\nAUTH_TRUST_HOST=true\nALLOW_DESTRUCTIVE_BASELINE_RESET=true\nCHAT_HISTORY_MAX_MESSAGES_PER_USER=200\nCHAT_HISTORY_DEFAULT_FETCH_LIMIT=40\nCHAT_HISTORY_MAX_FETCH_LIMIT=80\nCHAT_HISTORY_MESSAGE_MAX_CHARS=3000\nCHAT_CONVERSATION_DEFAULT_FETCH_LIMIT=20\nCHAT_CONVERSATION_MAX_FETCH_LIMIT=40\n";
  const editor = page.locator('.cm-content[role="textbox"]');
  await editor.click({ force: true });
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(content);
}
