(function(){
    'use strict';
    /* global myApp */
    myApp.run(['$q', 'Installer', 'AppsService', 'ResourcesLoader', 'UrlCleanup', function($q, Installer, AppsService, ResourcesLoader, UrlCleanup){

        var platformId = cordova.require('cordova/platform').id;

        function CrxInstaller(url, appId) {
            Installer.call(this, url, appId);
        }

        CrxInstaller.prototype = Object.create(Installer.prototype);

        CrxInstaller.prototype.type = 'crx';

        CrxInstaller.prototype.doUpdateApp = function(installPath) {
            var platformConfig = location.pathname.replace(/\/[^\/]*$/, '/crx_files/config.' + platformId + '.xml');
            var targetConfig = installPath + '/config.xml';
            var xhr;

            // The filename doesn't matter, but it needs to end with .crx for the zip plugin to unpack
            // it properly. So we always set the filename to package.crx.
            var crxFile = installPath.replace(/\/$/, '') + '/package.crx';

            return ResourcesLoader.downloadFromUrl(this.url, crxFile).then(function() {
                return ResourcesLoader.extractZipFile(crxFile, installPath);
            }).then(function() {
                // Copy in the config.<platform>.xml file from the harness.
                return ResourcesLoader.xhrGet(platformConfig);
            }).then(function(_xhr){
                xhr = _xhr;
                return ResourcesLoader.ensureDirectoryExists(targetConfig);
            }).then(function() {
                return ResourcesLoader.writeFileContents(targetConfig, xhr.responseText);
            });
        };

        AppsService.registerInstallerFactory({
            type: 'crx',
            createFromUrl: function(url) {
                url = UrlCleanup(url);

                // TODO: Fix the missing appId, somehow.
                return $q.when(new CrxInstaller(url, 'New Chrome App'));
            },

            createFromJson: function(url, appId) {
                return new CrxInstaller(url, appId);
            }
        });
    }]);
})();
