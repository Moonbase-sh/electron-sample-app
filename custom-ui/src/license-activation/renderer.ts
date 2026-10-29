import type { ActivationState, LockReason } from '@moonbase.sh/licensing';
import '../index.css';
import './index.css';

// Why the app lost its license, for a customer who had one
const lockMessages: Record<LockReason, string> = {
    deactivated: 'This computer was deactivated.',
    expired: 'Your license has expired.',
    invalid: 'Your license is no longer valid on this computer.',
    unverified: 'Your license couldn\'t be checked with Moonbase for a while. Connect to the internet and restart the app, or activate again.',
    notCovered: 'Your license doesn\'t cover this version of the app.',
}

const noticeFor = (state: ActivationState) => {
    if (state.status === 'trialExpired') {
        const ended = state.expiredTrial?.expiresAt
        return `Your trial ${ended ? `ended on ${ended.toLocaleDateString(undefined, { dateStyle: 'medium' })}` : 'has ended'}. Buy a license to keep using the app.`
    }
    if (state.status === 'notCovered') {
        // What the license covers, and where to upgrade, are in state.notCovered
        const { appVersion, releaseAccess } = state.notCovered
        const coversUpTo = releaseAccess?.upToVersion
            ?? (releaseAccess?.upToMajor !== undefined ? `${releaseAccess.upToMajor}.x` : undefined)
        return coversUpTo
            ? `Your license covers versions up to ${coversUpTo}, not ${appVersion}. Upgrade it to use this version.`
            : `Your license doesn't cover version ${appVersion}. Upgrade it to use this version.`
    }
    return state.lockReason ? lockMessages[state.lockReason] : null
}

window.addEventListener('DOMContentLoaded', async () => {
    const api = (window as unknown as {
        licensing: {
            state: () => Promise<ActivationState>
            onStateChanged: (listener: (state: ActivationState) => void) => void
            startActivation: () => Promise<void>
            cancelActivation: () => Promise<void>
            upgradeLicense: () => Promise<void>
            refresh: () => Promise<void>
            generateDeviceToken: () => Promise<boolean>
            selectLicenseToken: () => Promise<void>
        }
    }).licensing

    const activateButton = document.getElementById('activate')
    const activationLink = document.getElementById('activation-link') as HTMLAnchorElement
    const checkAgainButton = document.getElementById('check-again')

    const show = (id: string, visible: boolean) => {
        document.getElementById(id).hidden = !visible
    }

    const showText = (id: string, text: string | null | undefined) => {
        const element = document.getElementById(id)
        element.textContent = text ?? ''
        element.hidden = !text
    }

    const render = (state: ActivationState) => {
        const activating = state.status === 'activating'
        const notCovered = state.status === 'notCovered'

        // One screen at a time: activate, wait for the browser, or upgrade
        show('welcome', !activating && !notCovered)
        show('activating', activating)
        show('not-covered', notCovered)
        show('offline', !activating)

        showText('notice', activating ? null : noticeFor(state))

        // When activation fails, the controller words the reason for the customer
        showText('error', state.error?.message)

        const trialExpired = state.status === 'trialExpired'
        showText('welcome-lead', trialExpired
            ? 'Buy a license, or sign in to a license you already own. It all happens in your browser.'
            : 'Buy a license, start a free trial, or sign in to a license you already own. It all happens in your browser.')
        activateButton.textContent = trialExpired ? 'Buy or activate in your browser' : 'Activate in your browser'

        // The link to finish activating at, for a browser that didn't open or was closed
        const activation = state.activation
        activationLink.hidden = !activation?.browserUrl
        activationLink.href = activation?.browserUrl ?? ''
        showText('activating-lead', activation?.browserOpenFailed
            ? 'Your browser didn\'t open. Open the activation page to continue.'
            : 'Finish activating in the browser window that opened. This window carries on by itself once you\'re done.')

        checkAgainButton.toggleAttribute('disabled', state.refreshing)
    }

    api.onStateChanged(render)
    render(await api.state())

    // Every failure below also lands in the state, worded for the customer, so they
    // only need logging here. Saving a device token is the exception.
    const onClick = (id: string, action: () => Promise<unknown>) => {
        document.getElementById(id).addEventListener('click', () => {
            action().catch((err) => console.error(`${id} failed`, err))
        })
    }

    // The browser activation: Moonbase starts trials in the same flow as purchases
    onClick('activate', () => api.startActivation())
    onClick('cancel-activation', () => api.cancelActivation())

    // For a license that doesn't cover this version: buy the upgrade, then check again
    onClick('upgrade', () => api.upgradeLicense())
    onClick('check-again', () => api.refresh())

    // Offline activation: save a device token, and select the license file the customer gets for it
    onClick('select-license', () => api.selectLicenseToken())
    document.getElementById('activate-offline').addEventListener('click', async () => {
        try {
            show('device-token-saved', await api.generateDeviceToken())
        } catch (err) {
            console.error('Could not generate device token', err)
            showText('error', 'Could not generate device token')
        }
    })
})
