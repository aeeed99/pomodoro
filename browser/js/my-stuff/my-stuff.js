app.config(function ($stateProvider) {

    $stateProvider.state('myStuff', {
        url: '/me',
        templateUrl: '/js/my-stuff/my-stuff.html',
        controller: 'myStuff',
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        }
    });

});

app.controller('myStuff', function ($scope) {
    $scope.init = "hello from mystuff!"
})

app.factory('SecretStash', function ($http) {

    var getStash = function () {
        return $http.get('/api/members/secret-stash').then(function (response) {
            return response.data;
        });
    };

    return {
        getStash: getStash
    };

});
