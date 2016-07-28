app.factory('ProfileUpdater', function ($http, Session, $rootScope) {

    //wrpper for $http that automatucally broadcasts an event (so we don't have to keep calling it. Sly and DRY)
    let http = function (method, url, body) {
        return $http[method.toLowerCase()](url, body)
            .then(res => $rootScope.$broadcast('update-controller', res.data));
    };

    return {
        pushTomatoMeter: function (tomato) {
            // stuff goes here
            console.log("what is the session anywho ??", Session);
            return http('PUT', '/api/user/tomatoMeter', {
                user: Session.user._id,
                tomato,
            });
        },
        deleteTomatoMeter: function () {
            // deletes the current tomato meter of the day.
            console.log("sennois? ", Session);
            return $http.delete('/api/user/tomatoMeter?user='+Session.user._id);
        }
    }
});
