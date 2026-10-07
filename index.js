/**
 * Node half of the Arabic (RTL) client plugin.
 *
 * This half deliberately does nothing on the Host: the plugin only contributes
 * browser-side behaviour (language registration, document direction, stylesheet).
 * The host half must still exist and export `apply` so the Loader row activates
 * and `dsh-client-modules` can serve the `./client` bundle.
 */
export function apply() {}
