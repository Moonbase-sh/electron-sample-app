/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 */

import type { ActivationState, MoonbaseRendererApi } from '@moonbase.sh/electron/preload';
import './index.css';

window.addEventListener('DOMContentLoaded', async () => {
    const moonbase = (window as unknown as { moonbase: MoonbaseRendererApi }).moonbase
    const detailsElement = document.getElementById('license-details')

    const row = (label: string, value: string) => {
        const term = document.createElement('dt')
        term.textContent = label
        const detail = document.createElement('dd')
        detail.textContent = value
        return [term, detail]
    }

    const render = (state: ActivationState) => {
        const license = state.license
        if (!license) {
            detailsElement.replaceChildren(...row('License', state.status === 'loading' ? 'Checking…' : 'Not activated'))
            return
        }
        detailsElement.replaceChildren(
            ...row('License ID', license.id),
            ...row('User name', license.issuedTo.name),
            ...row('User email', license.issuedTo.email),
            ...row('Product name', license.product.name),
            ...row('Type', license.trial ? 'Trial' : 'License'),
            ...row('Expires', license.expiresAt?.toDateString() ?? 'never'),
        )
    }

    // Show the license, and show it again whenever it changes: once the app is
    // activated, and when the license is refreshed or deactivated
    moonbase.onStateChanged(render)
    render(await moonbase.state())

    // The built-in UI has the full license details, with seats, the license ID to
    // copy for support, and a button to deactivate this device
    document.getElementById('manage-license').addEventListener('click', () => moonbase.present({ screen: 'license' }))
})
