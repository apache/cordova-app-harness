UrlRemap
=========

Enables dynamic rerouting of URLs.

# iOS Quirks

- Top-level navigations to file:/// URLs cannot be remapped while preserving history.back() functionality (OS bug).

# Android Quirks

- Requires Android 3.0 or greater.
- Cannot remap file:/// URLs when the target file exists on the filesystem (OS bug).

## Api

    appBundle.addAlias(string matchRegex, string replaceRegex, string replaceString, boolean redirect, function callback(succeeded){});
    appBundle.setResetUrl(string matchRegex, callback(){});
    appBundle.injectJsForUrl(string matchRegex, string jsToInject, callback(){});
    appBundle.clearAllAliases(function callback(){});

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

