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

import org.apache.cordova.AndroidWebView;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Build;
import android.util.Log;
import android.view.MotionEvent;
import android.webkit.WebView;

class CustomAndroidWebView extends AndroidWebView implements CustomCordovaWebView {
    private static final String LOG_TAG = "AppHarnessUI";

    private AppHarnessUI parent;

    public CustomAndroidWebView(AppHarnessUI parent, Context context) {
        super(context);
        this.parent = parent;
        twoFingerTapDetector = new TwoFingerDoubleTapGestureDetector();
        twoFingerTapDetector.setParent(parent);
    }

    public void setStealTapEvents(boolean value){
        stealTapEvents=value;
    }

    TwoFingerDoubleTapGestureDetector twoFingerTapDetector;
    boolean stealTapEvents;

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        if (stealTapEvents) {
            if (e.getAction() == MotionEvent.ACTION_UP) {
                parent.sendEvent("hideMenu");
            }
            return true;
        }
        twoFingerTapDetector.onTouchEvent(e);
        return super.onTouchEvent(e);
    }

    @SuppressLint("NewApi")
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        // Needed for the view to stay in the bottom when rotating.
        setPivotY(h);
    }

    @SuppressLint("NewApi")
    public void evaluateJavascript(String script) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            loadUrl("javascript:" + script);
        } else {
            ((WebView)this).evaluateJavascript(script, null);
        }
    }
    
    @Override
    public boolean backHistory() {
        if (canGoBack()) {
            return super.backHistory();
        }
        if (parent.slaveVisible) {
            parent.sendEvent("showMenu");
            return true;
        }
        // Should never get here since the webview does not have focus.
        Log.w(LOG_TAG, "Somehow back button was pressed when app not visible");
        return false;
    }
}
