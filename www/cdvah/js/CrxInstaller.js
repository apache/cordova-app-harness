(function(){
    'use strict';
    /* global myApp */
    myApp.run(['$q', 'Installer', 'AppsService', 'ResourcesLoader', 'urlCleanup', function($q, Installer, AppsService, ResourcesLoader, urlCleanup){

        var platformId = cordova.require('cordova/platform').id;

        function CrxInstaller(url, appId) {
            Installer.call(this, url, appId);
        }

        CrxInstaller.prototype = Object.create(Installer.prototype);

        CrxInstaller.prototype.type = 'crx';

        CrxInstaller.prototype.doUpdateApp = function() {
            var installPath = this.installPath;
            var platformConfig = location.pathname.replace(/\/[^\/]*$/, '/crx_files/config.' + platformId + '.xml');
            var targetConfig = installPath + '/config.xml';

            // The filename doesn't matter, but it needs to end with .crx for the zip plugin to unpack
            // it properly. So we always set the filename to package.crx.
            var crxFile = installPath.replace(/\/$/, '') + '/package.crx';

            return ResourcesLoader.downloadFromUrl(this.url, crxFile).then(function() {
                return ResourcesLoader.extractZipFile(crxFile, installPath + '/www');
            }).then(function() {
                // Copy in the config.<platform>.xml file from the harness.
                return ResourcesLoader.downloadFromUrl(platformConfig, targetConfig);
            });
        };

        AppsService.registerInstallerFactory({
            type: 'crx',
            createFromUrl: function(url) {
                url = urlCleanup(url);

                // TODO: Fix the missing appId, somehow.
                return $q.when(new CrxInstaller(url, 'New Chrome App'));
            },

            createFromJson: function(url, appId) {
                return new CrxInstaller(url, appId);
            }
        });
    }]);
})();
