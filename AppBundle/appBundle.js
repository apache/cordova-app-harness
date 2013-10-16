var exec = cordova.require('cordova/exec');

exports.addAlias = function(sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl, callback) {
    var win = callback && function() {
        callback(true);
    };
    var fail = callback && function(error) {
        callback(false);
        console.error("AppBundle error: " + error);
    };
    exec(win, fail, 'AppBundle', 'addAlias', [sourceUriMatchRegex, sourceUriReplaceRegex, replaceString, redirectToReplacedUrl]);
};

exports.clearAllAliases = function(callback){
    var win = callback && function() {
        callback(true);
    };
    var fail = callback && function(error) {
        callback(false);
        console.error("AppBundle error: " + error);
    };
    exec(win, fail, 'AppBundle', 'clearAllAliases', []);
};