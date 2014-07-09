
    @Override
    public void onBackPressed() {
        // If app is running, quit it.
        AppHarnessUI ahui = (AppHarnessUI)appView.getPluginManager().getPlugin("AppHarnessUI");
        if (ahui != null) {
            if (ahui.isSlaveCreated()) {
                ahui.sendEvent("quitApp");
                return;
            }
        }
        // Otherwise, hide instead of calling .finish().
        moveTaskToBack(true);
    }

    @Override
    public Object onMessage(String id, Object data) {
        // Capture the app calling navigator.app.exitApp().
        if ("exit".equals(id)) {
            AppHarnessUI ahui = (AppHarnessUI)appView.getPluginManager().getPlugin("AppHarnessUI");
            if (ahui != null) {
                if (ahui.isSlaveCreated()) {
                    ahui.sendEvent("quitApp");
                    return new Object();
                }
            }
        }
        return super.onMessage(id, data);
    }
