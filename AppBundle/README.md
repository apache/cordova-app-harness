AppBundle
=========

This plugin allows any uri's that are loaded to be replaced with modified uri's
These include uri's being loaded by the browser such as page navigation, script tags.
This also includes file uris being opened by file api etc. (currently android only)

##AppBundle Uri's
This plugin allows the use of "app-bundle://" instead of platform specific urls such "file:///android_asset" etc.
For example to refer to an index.html file in the "www" folder with an absolute path, you can use

    "app-bundle:///index.html"

This will navigate you to "file:///android_asset/www/index.html" on android and similarly for ios.

##Custom Uri replacement schemes
You can add your own url replacements to this plugin as well.

###Api

    appBundle.addAlias(string matchRegex, string replaceRegex, string replaceString, boolean redirect, function callback(succeeded){});
    appBundle.clearAllAliases(function callback(succeeded){});

*   matchRegex -> allows you to specify a regex that determines which url's are replaced.
*   replaceRegex -> allows you to specify what part of the url's are replaced.
*   replacerString -> what to replace the above match with
*   redirect -> this affects top level browser navigation only (changing your browser's location)
    Assume you redirect requests from http://mysite.com/ to file:///storage/www/
    If you set this to true, the document.location after redirection would be "file:///storage/www/", if you set it to false it will be "http://mysite.com/"

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

###Examples

Map http requests to file

    appBundle.addAlias("^http://mysite\.com/.*", "^http://mysite\.com/", "file://storage_card/", false, function(succeded){});

Map http requests to another http location, or file to file

    appBundle.addAlias("^http://mysite\.com/.*", "^http://mysite\.com/", "http:///mysiteproxy.com/", false, function(succeded){});

Map http requests to your bundle

    appBundle.addAlias("^http://mysite\.com/.*", "^http://mysite\.com/", "app-bundle:///", false, function(succeded){});

Map bundle requests to http or file. Note the usage of the "{BUNDLE_WWW}" param here. This is replaced by "file:///android_asset/" on android and similarly on ios.

Why use "BUNDLE_WWW" and not "app-bundle:///"? "app-bundle:" uri's always point to your bundle and CANNOT be redirected. Also other parts of your program may make requests to to "file://android_assets/www" directly (which many plugins actually do). You would expect all requests to get redirected. The "BUNDLE_WWW" takes care of this.

    appBundle.addAlias("^{BUNDLE_WWW}.*", "^{BUNDLE_WWW}", "http://mysite\.com", false, function(succeded){});

Apply recursive replacements. A request to http://mysite.com/blah should give http:///mysiteproxy2.com/blah as the recursive replacements apply the rules last to first.

    appBundle.addAlias("^http://mysite\.com/.*", "^http://mysite\.com/", "{BUNDLE_WWW}", false, function(succeded){});
    appBundle.addAlias("^{BUNDLE_WWW}.*", "^{BUNDLE_WWW}", "file://storage/www/", false, function(succeded){});
    appBundle.addAlias("^http://mysite\.com/.*", "^http://mysite\.com/", "http:///mysiteproxy.com/", false, function(succeded){});
    appBundle.addAlias("^http:///mysiteproxy\.com/.*", "^http:///mysiteproxy\.com/", "http:///mysiteproxy2.com/", false, function(succeded){});

##Installation - Cordova  2.7 or later
        cordova plugin add directory-of-the-AppBundle-plugin
