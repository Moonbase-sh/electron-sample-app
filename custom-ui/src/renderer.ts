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

import type { ActivationState, ReleaseAccess } from '@moonbase.sh/licensing';
import './index.css';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

const formatDate = (date: Date) => date.toLocaleDateString(undefined, { dateStyle: 'medium' })

const daysLeft = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} left`

// Which versions of the app the license covers, when that isn't every version
const coveredVersions = (access: ReleaseAccess | undefined) => {
    if (access?.upToVersion) return `Up to version ${access.upToVersion}`
    if (access?.updatesUntil) return `Released until ${formatDate(access.updatesUntil)}`
    if (access?.upToMajor !== undefined) return `Up to version ${access.upToMajor}.x`
    return 'All versions'
}

window.addEventListener('DOMContentLoaded', async () => {
    const api = (window as unknown as {
        licensing: {
            state: () => Promise<ActivationState>
            onStateChanged: (listener: (state: ActivationState) => void) => void
            deactivate: () => Promise<void>
        }
    }).licensing

    const detailsElement = document.getElementById('license-details')
    const deactivateButton = document.getElementById('deactivate')

    const showText = (id: string, text: string | null | undefined) => {
        const element = document.getElementById(id)
        element.textContent = text ?? ''
        element.hidden = !text
    }

    const render = (state: ActivationState) => {
        const license = state.license
        if (!license) return

        const online = license.activationMethod === 'Online'
        const expires = license.expiresAt
            ? `${formatDate(license.expiresAt)} (${daysLeft(license.daysRemaining ?? 0)})`
            : 'Never'

        const status = document.getElementById('status')
        status.textContent = license.trial ? 'Trial' : 'Licensed'
        status.classList.toggle('trial', license.trial)

        document.getElementById('greeting').textContent = `Welcome, ${license.issuedTo.name}`
        showText('summary', license.trial
            ? `You're trying out ${license.product.name}, with everything unlocked until the trial ends.`
            : `${license.product.name} is activated on this computer, with everything unlocked.`)

        // A newer release than the app, from the license alone
        showText('update', state.update
            ? `Version ${state.update.latestVersion} is out. You have ${state.update.currentVersion}.`
            : null)

        // The controller words the last failure, such as a deactivation that couldn't reach Moonbase
        showText('error', state.error?.message)

        // Everything the license says, leaving out what doesn't apply to it
        const rows: [string, string | null][] = [
            ['Licensed to', license.issuedTo.name],
            ['Email', license.issuedTo.email],
            ['Product', license.product.name],
            ['Type', license.trial ? 'Trial' : license.subscriptionId ? 'Subscription' : 'Full license'],
            ['Expires', expires],
            ['Updates', license.trial ? null : coveredVersions(license.releaseAccess)],
            ['Seats', license.seatCount ? `${license.seatsUsed ?? 0} of ${license.seatCount} in use` : null],
            ['Add-ons', state.activeSubProducts.length > 0 ? state.activeSubProducts.join(', ') : null],
            ['Activated', online ? 'Online' : 'Offline, with a license file'],
            ['Last checked', online ? license.validatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null],
            ['License ID', license.id],
        ]
        detailsElement.replaceChildren(...rows
            .filter(([, value]) => value !== null)
            .flatMap(([label, value]) => {
                const term = document.createElement('dt')
                term.textContent = label
                const detail = document.createElement('dd')
                detail.textContent = value
                return [term, detail]
            }))

        // Trials and offline licenses can't be handed back to Moonbase, so deactivating
        // only removes them from this computer
        deactivateButton.toggleAttribute('disabled', state.busy)
        deactivateButton.textContent = state.busy ? 'Deactivating…' : 'Deactivate this computer'
        showText('deactivate-hint', online && !license.trial
            ? 'Frees this computer\'s seat, so you can activate the app on another computer.'
            : 'Removes the license from this computer.')
    }

    // Show the license, and show it again whenever it changes, such as when it is refreshed
    api.onStateChanged(render)
    render(await api.state())

    deactivateButton.addEventListener('click', async () => {
        try {
            // Once deactivated, the app has no license, and main.ts switches to the license activation window
            await api.deactivate()
        } catch (err) {
            // The state has the error to show
            console.error('Could not deactivate', err)
        }
    })
})
