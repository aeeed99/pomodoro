app.directive('splashScreen', function () {
    return {
        restrict: 'E',
        template: '<div id="splash-screen"><div id="loading-content">{{loadingText}}</div></div>',
        link: function (scope, ele) {

            scope.loadingText = "Loading";
            var interval = setInterval(() => {
                console.log("interval")
                var append = scope.loadingText + " .";
                if(append.length > 14) append = "Loading";
                scope.loadingText = append;
                scope.$digest();
            }, 400)

            setTimeout(() => {
                clearInterval(interval);
                ele.remove();
            },2300);

        }
    }
});
