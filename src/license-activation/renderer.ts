import './index.css';

window.addEventListener('DOMContentLoaded', () => {
    const api = (window as unknown as {
        licensing: {
            startActivation: () => Promise<void>
            generateDeviceToken: () => Promise<void>
            selectLicenseToken: () => Promise<void>
        }
    }).licensing

    const activateButton = document.getElementById('activate')

    activateButton.addEventListener('click', async () => {
        // Once the button is clicked, we disabled it.
        // You could also change the UI to show a spinner while activating.
        activateButton.setAttribute('disabled', 'true')

        try {
            // We also need to call the backend licensing API to start the backend process:
            await api.startActivation()
        } catch (err) {
            // TODO: Show error
            console.error('Could not activate app', err)
            activateButton.removeAttribute('disabled')
        }
    })

    const activateOfflineButton = document.getElementById('activate-offline')

    activateOfflineButton.addEventListener('click', async () => {
        try {
            // We also need to call the backend licensing API to start the backend process:
            await api.generateDeviceToken()

            const instructions = document.createElement('p')
            instructions.innerHTML = 'Please upload the "device.dt" file to <a href="https://demo.moonbase.sh/activate" target="_blank">https://demo.moonbase.sh/activate</a>.'
            activateOfflineButton.parentElement.appendChild(instructions)
        } catch (err) {
            // TODO: Show error
            console.error('Could not generate machine file', err)
        }
    })

    const selectLicenseButton = document.getElementById('select-license')

    selectLicenseButton.addEventListener('click', async () => {
        try {
            // We also need to call the backend licensing API to start the backend process:
            await api.selectLicenseToken()
        } catch (err) {
            // TODO: Show error
            console.error('Could not select license', err)
        }
    })
})
