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

import org.apache.cordova.CordovaWebViewEngine;
import org.apache.cordova.engine.SystemWebView;
import org.apache.cordova.engine.SystemWebViewEngine;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Build;
import android.util.Log;
import android.view.MotionEvent;

class CustomAndroidWebView extends SystemWebViewEngine implements CustomCordovaWebView {
    private static final String LOG_TAG = "CustomAndroidWebView";

    private AppHarnessUI parent;
    TwoFingerDoubleTapGestureDetector twoFingerTapDetector;
    boolean stealTapEvents;

    public CustomAndroidWebView(AppHarnessUI parent, Context context) {
        super(new CustomView(context));
        this.parent = parent;
        ((CustomView)webView).parent = this;
        twoFingerTapDetector = new TwoFingerDoubleTapGestureDetector(parent);
    }

    @Override
    public void setStealTapEvents(boolean value){
        stealTapEvents=value;
    }

    @SuppressLint("NewApi")
    @Override
    public void evaluateJavascript(String script) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            webView.loadUrl("javascript:" + script);
        } else {
            webView.evaluateJavascript(script, null);
        }
    }

    @Override
    public CordovaWebViewEngine asEngine() {
        return this;
    }

    @Override
    public boolean goBack() {
        if (canGoBack()) {
            return super.goBack();
        }
        if (parent.slaveVisible) {
            parent.sendEvent("showMenu");
            return true;
        }
        // Should never get here since the webview does not have focus.
        Log.w(LOG_TAG, "Somehow back button was pressed when app not visible");
        return false;
    }

    private static class CustomView extends SystemWebView {
        CustomAndroidWebView parent;
        public CustomView(Context context) {
            super(context);
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            if (parent.stealTapEvents) {
                if (e.getAction() == MotionEvent.ACTION_UP) {
                    parent.parent.sendEvent("hideMenu");
                }
                return true;
            }
            parent.twoFingerTapDetector.onTouchEvent(e);
            return super.onTouchEvent(e);
        }

        @SuppressLint("NewApi")
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            super.onSizeChanged(w, h, oldw, oldh);
            // Needed for the view to stay in the bottom when rotating.
            setPivotY(h);
        }
    }
}
