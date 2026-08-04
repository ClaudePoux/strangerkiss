(function () {
    function checkVersion() {
        fetch('version.json', { cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.version && data.version !== window.LEXIKA_VERSION) {
                    window.location.reload();
                }
            })
            .catch(function () {});
    }

    checkVersion();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkVersion();
    });
})();
