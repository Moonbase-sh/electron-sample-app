/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import { License } from '@moonbase.sh/licensing';
import './index.css';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

window.addEventListener('DOMContentLoaded', async () => {
    // Load the license to display it:
    const api = (window as unknown as { licensing: { loadLicense: () => Promise<License> } }).licensing
    const license = await api.loadLicense()
    const detailsElement = document.getElementById('license-details')
    detailsElement.innerHTML = `
    <strong>License ID</strong>: ${license.id}<br>
    <strong>User name</strong>: ${license.issuedTo.name}<br>
    <strong>User email</strong>: ${license.issuedTo.email}<br>
    <strong>Product name</strong>: ${license.product.name}<br>
    <strong>Expires</strong>: ${license.expiresAt?.toDateString() ?? 'never'}`
})
