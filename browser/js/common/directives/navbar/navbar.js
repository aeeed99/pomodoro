app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state, $window) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function (scope) {

            scope.items = [
                { label: 'Pomodoro', state: 'home' },
                { label: 'My Stuff', state: 'me', auth: true},
                { label: 'Learn', state: 'learn'},
                { label: 'About / Support', state: 'about' },
            ];
            scope.state = $state;

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                   $state.go('home');
                });
            };

            var setUser = function () {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function () {
                scope.user = null;
            };
            setUser();

            scope.goBack = function () {
                $window.history.back();
            };

            $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
            $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);

            var $dropdown = $(".navbar-nav-mobile-dropdown");

            scope.toggleMobileDropdown = function () {
                if($state.current.name === 'login') return;
                $dropdown.toggleClass('opened');
            };
            var closeDropdown = function () {
                $dropdown.removeClass('opened');
            };
            $rootScope.$on('$stateChangeStart', closeDropdown);
            $rootScope.$on('$stateChangeSuccess', function () {
                $('#main').on('click', closeDropdown);
            })

        }

    };

});
