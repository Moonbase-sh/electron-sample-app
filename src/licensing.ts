import { app } from "electron"
import { FileLicenseStore, MoonbaseLicensing } from "@moonbase.sh/licensing"

const licensing = new MoonbaseLicensing({
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

    // Reported with every activation and validation, so you can see which
    // versions of your app your customers are running
    appVersion: app.getVersion(),

    // Keep the license with the rest of the app's data. The default is the
    // working directory, which a packaged app usually cannot write to.
    licenseStore: new FileLicenseStore({ dir: app.getPath('userData') }),
})

export default licensing
