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
import org.apache.cordova.PluginEntry;
import org.apache.cordova.PluginResult;
import org.json.JSONException;

import android.content.Context;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.ScaleGestureDetector.OnScaleGestureListener;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.LinearLayout;

public class AppHarnessUI extends CordovaPlugin {
    private static final String LOG_TAG = "AppHarnessUI";
    ViewGroup contentView;
    View origMainView;
    CustomCordovaWebView slaveWebView;
    CordovaWebView overlayWebView;
    CallbackContext eventsCallback;

    public CordovaWebView getSlave() {
        return slaveWebView;
    }

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
        } else if ("createOverlay".equals(action)) {
            final String url = args.getString(0);
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    createOverlay(url, callbackContext);
                }
            });
        } else if ("destroyOverlay".equals(action)) {
            this.cordova.getActivity().runOnUiThread(new Runnable() {
                public void run() {
                    destroyOverlay(callbackContext);
                }
            });
        } else if ("events".equals(action)) {
            eventsCallback = callbackContext;
        } else {
            return false;
        }
        return true;
    }

    void sendEvent(String eventName) {
        PluginResult pluginResult = new PluginResult(PluginResult.Status.OK, eventName);
        pluginResult.setKeepCallback(true);
        eventsCallback.sendPluginResult(pluginResult );
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
            contentView.removeAllViews();
            contentView.addView((View)slaveWebView.getParent());
            slaveWebView.loadUrl(url);
        }
        callbackContext.success();
    }

    private void destroy(CallbackContext callbackContext) {
        if (slaveWebView == null) {
            Log.w(LOG_TAG, "destroy: already destroyed");
        } else {
            contentView.removeAllViews();
            contentView.addView(origMainView);
            slaveWebView.destroy();
            slaveWebView = null;
        }
        if (eventsCallback != null) {
            eventsCallback.success();
            eventsCallback = null;
        }
        callbackContext.success();
    }

    private void createOverlay(String url, CallbackContext callbackContext) {
        if (overlayWebView != null) {
            Log.w(LOG_TAG, "createOverlay: already exists");
        } else {
            overlayWebView = new CordovaWebView(cordova.getActivity());
            initWebView(overlayWebView);
            overlayWebView.pluginManager.addService(new PluginEntry("OverlayPlugin", new OverlayPlugin()));
            overlayWebView.setOverScrollMode(CordovaWebView.OVER_SCROLL_NEVER);
            contentView.addView((View)overlayWebView.getParent());
            overlayWebView.loadUrl(url);

        }
        callbackContext.success();
    }

    private void destroyOverlay(CallbackContext callbackContext) {
        if (overlayWebView == null) {
            Log.w(LOG_TAG, "destroyOverlay: already destroyed");
        } else {
            contentView.removeView((View)overlayWebView.getParent());
            overlayWebView.destroy();
            overlayWebView = null;
        }
        callbackContext.success();
    }


    private void initWebView(CordovaWebView newWebView) {
        CordovaActivity activity = (CordovaActivity)cordova.getActivity();
        if (contentView == null) {
            contentView = (ViewGroup)activity.findViewById(android.R.id.content);
            origMainView = contentView.getChildAt(0);
        }

        LinearLayoutSoftKeyboardDetect layoutView = new LinearLayoutSoftKeyboardDetect(activity, contentView.getWidth(), contentView.getHeight());
        layoutView.setOrientation(LinearLayout.VERTICAL);
//        layoutView.setBackground(origRootView.getBackground());
        layoutView.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT, 0.0F));


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

    private class OverlayPlugin extends CordovaPlugin {
        @Override
        public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
            if ("sendEvent".equals(action)) {
                sendEvent(args.getString(0));
                return true;
            }
            return false;
        }
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

    private class CustomCordovaWebView extends CordovaWebView implements OnScaleGestureListener {
        ScaleGestureDetector scaleGestureDetector;
        TwoFingerDoubleTapGestureDetector twoFingerTapDetector;

        public CustomCordovaWebView(Context context) {
            super(context);
            scaleGestureDetector = new ScaleGestureDetector(context, this);
            twoFingerTapDetector = new TwoFingerDoubleTapGestureDetector();
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            scaleGestureDetector.onTouchEvent(e);
            twoFingerTapDetector.onTouchEvent(e);
            return super.onTouchEvent(e);
        }

        @Override
        public boolean onScale(ScaleGestureDetector detector) {
            if (detector.getScaleFactor() < 0.6) {
                sendEvent("showMenu");
                return true;
            }
            return false;
        }

        @Override
        public boolean onScaleBegin(ScaleGestureDetector detector) {
            return true;
        }

        @Override
        public void onScaleEnd(ScaleGestureDetector detector) {
        }
    }
}
