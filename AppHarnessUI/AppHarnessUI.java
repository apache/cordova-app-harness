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

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaActivity;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaChromeClient;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.CordovaWebViewClient;
import org.apache.cordova.IceCreamCordovaWebViewClient;
import org.apache.cordova.LinearLayoutSoftKeyboardDetect;
import org.apache.cordova.PluginResult;
import org.json.JSONException;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.content.Context;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.ViewPropertyAnimator;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

public class AppHarnessUI extends CordovaPlugin {
    private static final String LOG_TAG = "AppHarnessUI";
    ViewGroup contentView;
    View origMainView;
    CustomCordovaWebView slaveWebView;
    boolean slaveVisible;
    CallbackContext eventsCallback;

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        if ("create".equals(action)) {
            final String url = args.getString(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    create(url, callbackContext);
                }
            });
        } else if ("destroy".equals(action)) {
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    destroy(callbackContext);
                }
            });
        } else if ("setVisible".equals(action)) {
            final boolean value = args.getBoolean(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    setSlaveVisible(value, callbackContext);
                }
            });
        } else if ("evalJs".equals(action)) {
            final String code = args.getString(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    evalJs(code, callbackContext);
                }
            });
        } else if ("events".equals(action)) {
            eventsCallback = callbackContext;
        } else {
            return false;
        }
        return true;
    }

    private void sendEvent(String eventName) {
        if (eventsCallback != null) {
            PluginResult pluginResult = new PluginResult(PluginResult.Status.OK, eventName);
            pluginResult.setKeepCallback(true);
            eventsCallback.sendPluginResult(pluginResult );
        }
    }

    @SuppressLint("NewApi")
    private void evalJs(String code, CallbackContext callbackContext) {
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "Not evaluating JS since no app is active");
        } else {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
                slaveWebView.loadUrl("javascript:" + code);
            } else {
                slaveWebView.evaluateJavascript(code, null);
            }
        }
        callbackContext.success();
    }

    private void create(String url, CallbackContext callbackContext) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();

        if (slaveWebView != null) {
            Log.w(LOG_TAG, "create: already exists");
        } else {
            slaveWebView = new CustomCordovaWebView(activity);
            initWebView(slaveWebView);
            if (activity.getBooleanProperty("DisallowOverscroll", false)) {
                slaveWebView.setOverScrollMode(CordovaWebView.OVER_SCROLL_NEVER);
            }
            slaveWebView.clearCache(true);
            slaveWebView.clearHistory();
            slaveWebView.loadUrl(url);
            View newView = (View)slaveWebView.getParent();
            contentView.addView(newView);
            slaveVisible = true;
            // Back button capturing breaks without these:
            newView.requestFocus();

        }
        callbackContext.success();
    }

    private void destroy(CallbackContext callbackContext) {
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "destroy: already destroyed");
        } else {
            contentView.removeView((View)slaveWebView.getParent());
            slaveWebView.destroy();
            origMainView.requestFocus();
            slaveWebView = null;
            slaveVisible = false;
            sendEvent("destroyed");
        }
        if (eventsCallback != null) {
            eventsCallback.success("");
            eventsCallback = null;
        }
        callbackContext.success();
    }

    @TargetApi(Build.VERSION_CODES.ICE_CREAM_SANDWICH)
    private void setSlaveVisible(boolean value, CallbackContext callbackContext) {
        if (value == slaveVisible) {
            return;
        }
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "setSlaveVisible: slave not created");
        } else {
            slaveVisible = value;
            ViewPropertyAnimator anim = slaveWebView.animate();
            // Note: Pivot is set in onSizeChanged.
            if (value) {
                anim.scaleX(1.0f).scaleY(1.0f);
                ((View)slaveWebView.getParent()).requestFocus();
            } else {
                anim.scaleX(.25f).scaleY(.25f);
                origMainView.requestFocus();
            }
            slaveWebView.stealTapEvents = !value;
            anim.setDuration(300).setInterpolator(new DecelerateInterpolator(2.0f)).start();
        }
        if (callbackContext != null) {
            callbackContext.success();
        }
    }

    private void initWebView(final CordovaWebView newWebView) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();
        if (contentView == null) {
            contentView = (ViewGroup)activity.findViewById(android.R.id.content);
            origMainView = contentView.getChildAt(0);
        }

        LinearLayoutSoftKeyboardDetect layoutView = new LinearLayoutSoftKeyboardDetect(activity, contentView.getWidth(), contentView.getHeight());
        layoutView.setOrientation(LinearLayout.VERTICAL);

//        layoutView.setBackground(origRootView.getBackground());
        layoutView.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.BOTTOM | Gravity.LEFT));

        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.HONEYCOMB) {
            newWebView.setWebViewClient(new CordovaWebViewClient(cordova, newWebView));
        } else {
            newWebView.setWebViewClient(new IceCreamCordovaWebViewClient(cordova, newWebView));
        }
        newWebView.setWebChromeClient(new CordovaChromeClient(cordova, newWebView));

        newWebView.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                1.0F));
        layoutView.addView(newWebView);
    }

    // Based on: http://stackoverflow.com/questions/12414680/how-to-implement-a-two-finger-double-click-in-android
    private class TwoFingerDoubleTapGestureDetector {
        private final int TIMEOUT = ViewConfiguration.getDoubleTapTimeout() + 100;
        private long mFirstDownTime = 0;
        private boolean mSeparateTouches = false;
        private byte mTwoFingerTapCount = 0;

        private void reset(long time) {
            mFirstDownTime = time;
            mSeparateTouches = false;
            mTwoFingerTapCount = 0;
        }

        public boolean onTouchEvent(MotionEvent event) {
            switch(event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                if(mFirstDownTime == 0 || event.getEventTime() - mFirstDownTime > TIMEOUT)
                    reset(event.getDownTime());
                break;
            case MotionEvent.ACTION_POINTER_UP:
                if(event.getPointerCount() == 2)
                    mTwoFingerTapCount++;
                else
                    mFirstDownTime = 0;
                break;
            case MotionEvent.ACTION_UP:
                if(!mSeparateTouches)
                    mSeparateTouches = true;
                else if(mTwoFingerTapCount == 2 && event.getEventTime() - mFirstDownTime < TIMEOUT) {
                    sendEvent("showMenu");
                    mFirstDownTime = 0;
                    return true;
                }
            }

            return false;
        }

    }

    private class CustomCordovaWebView extends CordovaWebView {
        TwoFingerDoubleTapGestureDetector twoFingerTapDetector;
        boolean stealTapEvents;

        public CustomCordovaWebView(Context context) {
            super(context);
            twoFingerTapDetector = new TwoFingerDoubleTapGestureDetector();
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            if (stealTapEvents) {
                if (e.getAction() == MotionEvent.ACTION_UP) {
                    sendEvent("hideMenu");
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
    }
}
