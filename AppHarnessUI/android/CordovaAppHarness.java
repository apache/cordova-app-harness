/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
 */

package org.apache.appharness;

import org.apache.appharness.AppHarnessUI;
import android.os.Bundle;
import org.apache.cordova.*;

public class CordovaAppHarness extends CordovaActivity
{
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        // Set by <content src="index.html" /> in config.xml
        loadUrl(launchUrl);
    }

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

}
