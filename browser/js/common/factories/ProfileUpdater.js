app.factory('ProfileUpdater', function ($http, Session) {
    return {
        pushTomatoMeter: function (tomato) {
            // stuff goes here
            console.log("what is the session anywho ??", Session);
            return $http.put('/api/user/tomatoMeter', {
                user: Session.user._id,
                tomato,
            })
        }
    }
});
