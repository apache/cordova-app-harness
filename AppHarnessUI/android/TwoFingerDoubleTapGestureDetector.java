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

import android.view.MotionEvent;
import android.view.ViewConfiguration;

// Based on: http://stackoverflow.com/questions/12414680/how-to-implement-a-two-finger-double-click-in-android
class TwoFingerDoubleTapGestureDetector {
    private AppHarnessUI parent;

    private final int TIMEOUT = ViewConfiguration.getDoubleTapTimeout() + 100;
    private long mFirstDownTime = 0;
    private boolean mSeparateTouches = false;
    private byte mTwoFingerTapCount = 0;

    public TwoFingerDoubleTapGestureDetector(AppHarnessUI parent) {
        this.parent = parent;
    }

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
                parent.sendEvent("showMenu");
                mFirstDownTime = 0;
                return true;
            }
        }

        return false;
    }

}
