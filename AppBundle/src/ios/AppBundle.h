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
#import <Foundation/Foundation.h>
#import <Cordova/CDVPlugin.h>

/*
This plugin allows any uri's that are loaded to be replaced with modified uri's
These include uri's being loaded by the browser such as page navigation, script tags.
*******************TODO: shravanrn************************
There is currently a DataResource mechanism bering reviewed for ios. This mechanism will provide a unified way to load and listen to all uri requets.
Once this goes through, this plugin can be modified to be able listen to oading of other uris such file uris being opened by file api as well.
*******************TODO: shravanrn************************

There are 4 parameters here that affect the replacement.
The matchRegex, replaceRegex, replacerString, shouldRedirect

The algorithm operates as follows

currently loading 'url'
if(url matches matchRegex){
    newUrl = url.replace(replaceRegex, replacerString)
    if(this is topLevelRequest){
        stopLoadingUrl()
        loadUrl(newUrl)
        return
    } else {
        url = newUrl
    }
}
continue loading 'url'

There are some implementation details involved here such as the ability to distinguish between top level requests and other requests.
Please see the code for details regarding this.

There is an array of {matchRegex, replaceRegex, replacerString, shouldRedirect} stored referred to as the reroute map

"app-bundle:" uri's are absolute uri's that point to your bundle.
By default the rerouteMap contains the parameters required to redirect
    app-bundle:///blah -> file:///android_asset/www/blah

The rerouteMap can be modified from javascript by calling the addAlias and clearAlias methods

Recursive replacements are supported by this plugin as well.
Consider the reroute map contains
     1) http://mysite.com/ -> file:///android_asset/www/
     2) file:///android_asset/www/blah -> file:///storage/www/
     3) http://mysite.com/ -> http:///mysiteproxy.com/
     4) http://mysiteproxy.com/ -> http:///mysiteproxy2.com/
A request to http://mysite.com/blah should give http:///mysiteproxy2.com/blah
Also note that the recursive replacements apply the rules last to first.

*******************TODO: shravanrn************************
Recursive replacements to app-bundle: should not occur
For example lets say the we have the rerouteParams set up as
     1) app-bundle:/// -> file:///android_asset/www/
     2) file:///android_asset/www/ -> file:///storage/www/
A request to app-bundle:///blah should give file:///android_asset/www/ NOT file:///storage/www/
This requirement is required by the definition of app-bundle: uris.
*******************TODO: shravanrn************************
*/
@interface AppBundle : CDVPlugin {}
- (void)addAlias:(CDVInvokedUrlCommand*)command;
- (void)clearAllAliases:(CDVInvokedUrlCommand*)command;
@end
