import './index.css';

window.addEventListener('DOMContentLoaded', () => {
    const api = (window as unknown as {
        licensing: {
            startActivation: () => Promise<void>
            generateDeviceToken: () => Promise<boolean>
            selectLicenseToken: () => Promise<void>
        }
    }).licensing

    const errorElement = document.getElementById('error')

    const showError = (message: string, err: unknown) => {
        // Errors thrown in the main process arrive as "Error invoking remote method '<channel>': <name>: <message>"
        const detail = (err as Error).message.replace(/^Error invoking remote method '[^']*': (\w+: )?/, '')
        errorElement.textContent = detail ? `${message}: ${detail}` : message
        errorElement.hidden = false
    }

    const clearError = () => {
        errorElement.hidden = true
    }

    const activateButton = document.getElementById('activate')

    activateButton.addEventListener('click', async () => {
        // Once the button is clicked, we disabled it.
        // You could also change the UI to show a spinner while activating.
        activateButton.setAttribute('disabled', 'true')
        clearError()

        try {
            // We also need to call the backend licensing API to start the backend process:
            await api.startActivation()
        } catch (err) {
            console.error('Could not activate app', err)
            showError('Could not activate app', err)
            activateButton.removeAttribute('disabled')
        }
    })

    const activateOfflineButton = document.getElementById('activate-offline')

    activateOfflineButton.addEventListener('click', async () => {
        clearError()

        try {
            // We also need to call the backend licensing API to start the backend process:
            const saved = await api.generateDeviceToken()
            if (saved) {
                document.getElementById('offline-instructions').hidden = false
            }
        } catch (err) {
            console.error('Could not generate device token', err)
            showError('Could not generate device token', err)
        }
    })

    const selectLicenseButton = document.getElementById('select-license')

    selectLicenseButton.addEventListener('click', async () => {
        clearError()

        try {
            // We also need to call the backend licensing API to start the backend process:
            await api.selectLicenseToken()
        } catch (err) {
            console.error('Could not select license', err)
            showError('Could not select license', err)
        }
    })
})
