// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { exposeMoonbase } from "@moonbase.sh/electron/preload";

// To let the app show the license of the user, we expose window.moonbase: the
// license state, and a way to open the activation UI
exposeMoonbase()
