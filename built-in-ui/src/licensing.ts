import { createMoonbase } from "@moonbase.sh/electron"

// The license is kept in license.mb in the app's user data folder, and
// app.getVersion() is reported to Moonbase, so neither needs setting here
const moonbase = createMoonbase({
    productId: 'demo-app',
    endpoint: 'https://demo.moonbase.sh',
    publicKey: `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAutOqeUiPMgYjAwQ53CyKhJSqojr2bejce0CshQi9Hd8mNZbkoROx
oS56eIzehFSlX4YwHnF47AR1+fPOe7Q33Cgzd6d9xqksiMH7sWK2mADIlB66vZdW
uk3Me0UMB22Biy1RQbSRMivu79MxCofsympoL/5CFjJLd1u37kxjuRWVLjJS84Rr
3L2W7R7Exnno/giC+L/Dv711mjgstmtlAQm5ZINvFvoLA1eFTDs6nlCs3dpJSiq3
fsBUMT9FtudzS5As54jeT/8MB66fJJ0A1LQ/v5CW8ACQYseFSIoOKErD3xU7QLIJ
ERUn++6CVMPvZo67jVbTY+GCXYfW4gGVZQIDAQAB
-----END RSA PUBLIC KEY-----`,

    // The built-in activation UI, which presents itself whenever the app has no license
    ui: {
        productName: 'Electron Sample App',

        // Lay the activation UI over the main window, which stays locked until the
        // app is licensed. Leave this out to show it in a window of its own instead,
        // for an app that stays usable without a license.
        presentation: 'overlay',
    },

    // The main window only shows the license and opens the activation UI, so that
    // is all its renderer may do through window.moonbase
    rendererAccess: 'read-only',
})

export default moonbase
