/** WHAT: Applies saved federation values only at an explicit form-hydration boundary. */
export function hydrateFederationForm(form, settings, { dirty = false, force = false } = {}) {
  if (dirty && !force) return false;
  form.elements.relayUrl.value = settings.relayUrl || '';
  form.elements.federationId.value = settings.federationId || '';
  form.elements.nodeId.value = settings.nodeId || '';
  form.elements.nodeLabel.value = settings.nodeLabel || '';
  form.elements.nodeCredential.value = '';
  return true;
}
