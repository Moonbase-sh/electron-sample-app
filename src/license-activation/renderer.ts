import './index.css';

window.addEventListener('DOMContentLoaded', () => {
    const activateButton = document.getElementById('activate')

    activateButton.addEventListener('click', async () => {
        // Once the button is clicked, we disabled it.
        // You could also change the UI to show a spinner while activating.
        activateButton.setAttribute('disabled', 'true')

        try {
            // We also need to call the backend licensing API to start the backend process:
            const api = (window as unknown as { licensing: { startActivation: () => Promise<void> } }).licensing
            await api.startActivation()
        } catch (err) {
            // TODO: Show error
            console.error('Could not activate app', err)
            activateButton.removeAttribute('disabled')
        }
    })
})
