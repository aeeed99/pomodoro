'use strict';

Notification.requestPermission();

window.app = angular.module('FullstackGeneratedApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate']);

app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
    // Trigger page refresh when accessing an OAuth route
    $urlRouterProvider.when('/auth/:provider', function () {
        window.location.reload();
    });
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state, $http) {

    $http.get('/api/production').then(function (res) {
        window.production = res.status === 201;
        window.ready = true;
        if (window.production) {
            var nilFn = function nilFn() {};
            console.log = nilFn;
            console.info = nilFn;
            console.warn = nilFn;
            console.error = nilFn;
        }
    });

    // The given state requires an authenticated user.
    var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
        return state.data && state.data.authenticate;
    };

    // $stateChangeStart is an event fired
    // whenever the process of changing a state begins.
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

        if (!destinationStateRequiresAuth(toState)) {
            // The destination state does not require authentication
            // Short circuit with return.
            return;
        }

        if (AuthService.isAuthenticated()) {
            // The user is authenticated.
            // Short circuit with return.
            return;
        }

        // Cancel navigating to new state.
        event.preventDefault();

        AuthService.getLoggedInUser().then(function (user) {
            // If a user is retrieved, then renavigate to the destination
            // (the second time, AuthService.isAuthenticated() will work)
            // otherwise, if no user is logged in, go to "login" state.
            if (user) {
                $state.go(toState.name, toParams);
            } else {
                $state.go('login');
            }
        });
    });
});

app.config(function ($stateProvider) {

    // Register our *about* state.
    $stateProvider.state('about', {
        url: '/about',
        controller: 'AboutController',
        templateUrl: 'js/about/about.html'
    });
});

app.controller('AboutController', function ($scope, FullstackPics) {

    // Images of beautiful Fullstack people.
    $scope.images = _.shuffle(FullstackPics);
});
app.config(function ($stateProvider) {
    $stateProvider.state('learn', {
        url: '/learn',
        templateUrl: '/js/learn/learn.html'
    });
});

app.config(function ($stateProvider) {

    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'js/login/login.html',
        controller: 'LoginCtrl'
    });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state, $rootScope, $window) {

    $scope.login = {};
    $scope.error = null;

    $scope.goBack = function () {
        $window.history.back();
    };

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function () {
            $state.go('home');
            console.info("setting guest mode to false ");
            $rootScope.guestMode = false;
        }).catch(function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});

app.config(function ($stateProvider) {

    $stateProvider.state('me', {
        url: '/me',
        templateUrl: '/js/my-stuff/my-stuff.html',
        controller: 'myStuff',
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        },
        resolve: {
            user: function user(Store, AuthService) {
                if (Store.user) return Store.user;
                return AuthService.getLoggedInUser().then(function (user) {
                    return user;
                });
            }
        }
    });
});

app.controller('myStuff', function ($scope, user) {
    console.log("#####", user);
    $scope.archive = user.archive.slice().reverse();
});

app.factory('SecretStash', function ($http) {

    var getStash = function getStash() {
        return $http.get('/api/members/secret-stash').then(function (response) {
            return response.data;
        });
    };

    return {
        getStash: getStash
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        controller: 'HomeCtrl',
        resolve: {
            user: function user(AuthService, $rootScope, Store) {
                return AuthService.getLoggedInUser().then(function (user) {
                    console.log("USER STATUSSSS ", user);
                    if (user) {
                        Store.user = user;
                        return user;
                    }
                    console.log("no user, doing local profile");
                    $rootScope.guestMode = true;
                    var localProfile = localStorage.getItem("profile");
                    if (localProfile) return JSON.parse(localProfile);
                    console.info("no local profile, creating one!");

                    var newLocalProfile = {
                        email: "",
                        tomsToday: 0,
                        tomatoMeter: [],
                        sunDial: Sd(),
                        archive: [],
                        unlockedFeatures: [],
                        lastLoggedIn: Date.now(),
                        name: "",
                        guest: true
                    };
                    localStorage.setItem("profile", JSON.stringify(newLocalProfile));
                    return newLocalProfile;
                });
            },
            profile: function profile() {
                return { status: 100 };
            }
        }
    });
});

app.controller('HomeCtrl', function ($scope, Store, profile, user, ProfileUpdater) {
    console.log("the user: ", user);
    $scope.production = window.production;

    if (profile.status === 202) {
        Store.archiveTomsEaten();
    }

    $scope.updateController = function () {
        return AuthService.getLoggedInUser().then(function (newUser) {
            user = newUser;
            $scope.$digest();
        });
    };
    $scope.$on('update-controller', function (event, newUser, error) {
        if (error) {
            console.log("an error happened!!!!!", newUser);
            return;
        }
        console.info("[HomeCtrl] `update-controller` triggered", newUser);
        user = newUser;
        $scope.tomatoMeter = user.tomatoMeter.concat({ class: 'wait', text: "..." });
        activeIdx = $scope.tomatoMeter.length - 1;
        completed = user.tomsToday || 0;
        // $scope.$digest();
        // $scope.updateController();
    });

    // assign current stats to pick up where we left off.
    $scope.isGuest = user.isGuest;
    $scope.tomatoMeter = user.tomatoMeter.concat({ class: 'wait', text: "..." });
    var completed = user.tomsToday || 0;

    // stuff that has a lifecycle
    $scope.state = {
        state: "OFF",
        timerRunning: false,
        timerPaused: false,
        onBreak: false,
        editing: false,
        message: "",
        standbyTimer: null,
        breakTimer: null
    };
    var state = $scope.state; // for better readability.
    var timer = { clearTimer: function clearTimer() {
            return null;
        } }; // to prevent invoking the function on an undefined on first call;
    var titleCache = void 0;

    var getGoal = function getGoal() {
        return $scope.goal || "eating a tomato";
    };

    $scope.getCompleted = function () {
        return completed;
    };
    $scope.getTotal = function () {
        return Store.getTotalToms(user);
    };

    // $scope.goal = "";


    $scope.time = "0:00";
    // $scope.state.onBreak = () => $scope.state.onBreak;
    var activeIdx = $scope.tomatoMeter.length - 1 || 0;

    $scope.startInitial = function (dontStopTimer) {
        dontStopTimer || timer.clearTimer();
    };

    $scope.startTimer = function () {
        var time = arguments.length <= 0 || arguments[0] === undefined ? [25, 0] : arguments[0];
        var completeFn = arguments[1];
        var intervalFn = arguments[2];

        intervalFn = intervalFn || function () {
            // assign scope and document title in one go
            if (state.state === "POMOBORO") document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « " + getGoal();
            if (state.state === "BREAK" || state.state === "LONG_BREAK") document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « BREAK";
            $scope.$digest();
        };
        console.log("INTERVAL FN ", intervalFn);
        timer.clearTimer();
        timer = new Timer(time, completeFn, intervalFn);
        if (state.state === "POMODORO") document.title = "[" + ($scope.time = "25:00") + "] « " + getGoal();
    };

    $scope.startPomodoro = function () {
        state.state = "null";
        setTimeout(function () {
            return state.state = 'POMODORO';
        }, 1000);
        state.timerRunning = true;

        var activeTom = $scope.tomatoMeter[activeIdx];
        activeTom.class = 'active';
        activeTom.text = completed + 1;

        var completeFn = function completeFn() {
            if (document.hidden) new Notification("Pomodoro complete", {
                body: "Take a 5 minute break or select other options",
                icon: "/public/tomato.png"
            });
            $scope._markComplete();
            $scope.$digest();
            return $scope.startBreak([5, 0]);
        };
        var intervalFn = function intervalFn() {
            // assign scope and document title in one go
            document.title = "[" + ($scope.time = timer.getMins() + ":" + timer.getSecs()) + "] « " + getGoal();
            $scope.$digest();
        };
        state.message = "Focus time!";
        document.title = "[" + ($scope.time = "25:00") + "] « " + getGoal();
        $scope.startTimer([25, 0], completeFn, intervalFn);
    };

    $scope.startBreak = function () {
        var time = arguments.length <= 0 || arguments[0] === undefined ? [5, 0] : arguments[0];

        state.state = 'null';
        setTimeout(function () {
            return state.state = 'BREAK';
        }, 1000);
        state.timmerRunning = false;
        state.onBreak = true;
        state.message = "You're on a break! You can turn this into a long break or start a new Pomodoro with the buttons below.";
        var completeFn = function completeFn() {
            if (document.hidden) new Notification("Break over!", {
                body: "Start another pomodoro, or take a long break.",
                icon: "/public/tomato.png"
            });
            $scope.postBreak();
        };
        $scope.startTimer(time, completeFn);
    };
    $scope.postBreak = function () {
        var time = arguments.length <= 0 || arguments[0] === undefined ? [1, 30] : arguments[0];

        state.state = 'null';
        setTimeout(function () {
            return state.state = "POST_BREAK";
        }, 1000);
        var forceBreakFn = function forceBreakFn() {
            $scope.startLongBreak([13, 30], true);
        };
        state.message = "Select what to do next. We will start a break in 1:30";
        state.timerRunning = false;
        timer = new Timer(time, forceBreakFn, function () {
            var standbyTime = timer.getMins() + ":" + timer.getSecs();
            state.message = "Select what to do next. This automatically becomes a long break in " + standbyTime;
            $scope.$digest();
        });
    };
    $scope.startLongBreak = function () {
        var time = arguments.length <= 0 || arguments[0] === undefined ? [15, 0] : arguments[0];
        var forced = arguments[1];

        state.state = "LONG_BREAK";
        $scope._markLongBreakStart();
        state.message = forced ? "You've been idle for a while. So we've made this a long break" : "Relax for a while, or start another Pomodoro if you're ready.";
        $scope.startTimer(time, function () {
            $scope._markLongBreakComplete();
            $scope.postBreak();
        });
    };

    $scope.stopCurrentTimer = function () {
        timer.clearInterval();
    };

    $scope.togglePause = function () {
        if (!timer) return;

        timer.togglePause();
        state.timerPaused = !state.timerPaused;
        if (!titleCache) {
            titleCache = document.title;
            document.title = "▐▐ " + document.title;
        } else {
            document.title = titleCache;
            titleCache = null;
        }
    };

    //// INTERNAL LOGIC ///
    // TODO this stuff should be moved off the scope and put into apropriate timeouts.

    $scope._markComplete = function () {
        var activeTom = $scope.tomatoMeter[activeIdx];
        // mark the pending tom complete
        activeTom.text = completed + 1; //for human readble 1-indexing
        activeTom.class = 'complete';

        completed++;
        activeIdx++;
        // $scope.tomatoMeter.push({class: 'wait', text: '...'})

        ProfileUpdater.pushTomatoMeter(activeTom);
        // .then(res => console.info("[home.js:markCoplete] user profile updated", res));
        // Store.profile.tomsEaten.today++;
    };

    $scope._markLongBreakStart = function () {
        var activeTom = $scope.tomatoMeter[activeIdx];
        activeTom.text = "#break#";
        activeTom.class = 'break';
        $scope.state.onBreak = true;
    };
    $scope._markLongBreakComplete = function () {
        document.title = "Pomodoro!";
        $scope.time = "0:00";
        var activeTom = $scope.tomatoMeter[activeIdx];
        activeIdx++;
        activeTom.class = "break complete";
        ProfileUpdater.pushTomatoMeter(activeTom);
    };
    $scope._markFailed = function () {
        if (!confirm("Mark pomodoro as failed?")) return;
        state.state = 'null';
        state.message = 'Marking failed...';
        $scope.goal = '';
        document.title = "Pomodoro!";
        $scope.time = ":(";
        setTimeout(function () {
            state.state = 'OFF';
            state.message = "Start a new pomodoro when ready.";
            $scope.$digest();
        }, 1000);
        var activeTom = $scope.tomatoMeter[activeIdx];
        activeIdx++;
        activeTom.class = 'fail';
        activeTom.text = 'X';
        ProfileUpdater.pushTomatoMeter(activeTom);
        timer.clearTimer();
    };

    $scope.deleteTomatoMeter = ProfileUpdater.deleteTomatoMeter;
    $scope.archiveTomatoMeter = ProfileUpdater.archiveTomatoMeter;

    var $inputGoal = $('input.goal'),
        $placeholder = $('#placeholder'),
        $goalInput = $('#goalInput');

    $scope.toggleEdit = function () {
        $placeholder.hide();
        $goalInput.show();
        setTimeout(function () {
            return document.getElementById('goalInput').focus();
        }, 0);
    };
    $goalInput.blur(function () {
        if (!$scope.goal) {
            $goalInput.hide();
            $placeholder.show();
        }
    });
    $goalInput.keypress(function (e) {
        if (e.keyCode === 13) {
            console.log("finish edit");
            $inputGoal.blur();
        }
    });
    //tomato button controls
    setTimeout($scope.$digest);
});

app.config(function ($stateProvider) {
    $stateProvider.state('docs', {
        url: '/docs',
        templateUrl: 'js/docs/docs.html'
    });
});

(function () {

    'use strict';

    // Hope you didn't forget Angular! Duh-doy.

    if (!window.angular) throw new Error('I can\'t find Angular!');

    var app = angular.module('fsaPreBuilt', []);

    app.factory('Socket', function () {
        if (!window.io) throw new Error('socket.io not found!');
        return window.io(window.location.origin);
    });

    // AUTH_EVENTS is used throughout our app to
    // broadcast and listen from and to the $rootScope
    // for important events about authentication flow.
    app.constant('AUTH_EVENTS', {
        loginSuccess: 'auth-login-success',
        loginFailed: 'auth-login-failed',
        logoutSuccess: 'auth-logout-success',
        sessionTimeout: 'auth-session-timeout',
        notAuthenticated: 'auth-not-authenticated',
        notAuthorized: 'auth-not-authorized'
    });

    app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS, Store) {
        var statusDict = {
            401: AUTH_EVENTS.notAuthenticated,
            403: AUTH_EVENTS.notAuthorized,
            419: AUTH_EVENTS.sessionTimeout,
            440: AUTH_EVENTS.sessionTimeout
        };
        return {
            responseError: function responseError(response) {
                $rootScope.$broadcast(statusDict[response.status], response);
                return $q.reject(response);
            }
        };
    });

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push(['$injector', function ($injector) {
            return $injector.get('AuthInterceptor');
        }]);
    });

    app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q, Store) {

        function onSuccessfulLogin(response) {

            console.log("on sucrrrrresss res : ", response);
            Store.newRes = response;
            checkForLocalStorage(response);

            var data = Store.newRes.data;
            console.log("new dahtaaa ", data);
            Session.create(data.id, data.user);
            // add the profile to the store factory, which will continue to update the user data
            // Store.profile = data.user.profile;
            Store.profile = data.user;
            Store.user = data.user && data.user.id;
            $rootScope.guestMode = false;
            $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
            return data.user;
        }

        // Uses the session factory to see if an
        // authenticated user is currently registered.
        this.isAuthenticated = function () {
            return !!Session.user;
        };
        function checkForLocalStorage(responseToPass) {
            var localProfile = localStorage.getItem('profile');
            if (localProfile) {
                localProfile = JSON.parse(localProfile);
                // merge local profile
                return $http.put('/api/user/localProfile', { localProfile: localProfile }).then(function (newResponse) {
                    console.log("THE NEW RESOPOSEEEEE", newResponse);
                    $rootScope.$broadcast('update-controller', newResponse.data);
                    localStorage.removeItem('profile');
                    Store.newRes = newResponse;
                    return newResponse;
                });
            } else return Store.newRes = responseToPass;
        }

        this.getLoggedInUser = function (fromServer) {

            // If an authenticated session exists, we
            // return the user attached to that session
            // with a promise. This ensures that we can
            // always interface with this method asynchronously.

            // Optionally, if true is given as the fromServer parameter,
            // then this cached value will not be used.
            if (this.isAuthenticated() && fromServer !== true) {
                return $q.when(Session.user);
            }

            // Make request GET /session.
            // If it returns a user, call onSuccessfulLogin with the response.
            // If it returns a 401 response, we catch it and instead resolve to null.
            return $http.get('/session', { loginTime: new Date() }).then(onSuccessfulLogin).catch(function () {
                return null;
            });
        };

        this.login = function (credentials) {
            return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
                return $q.reject({ message: 'Invalid login credentials.' });
            });
        };

        this.logout = function () {
            return $http.get('/logout').then(function () {
                Session.destroy();
                $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
            });
        };
    });

    app.service('Session', function ($rootScope, AUTH_EVENTS) {

        var self = this;

        $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
            self.destroy();
        });

        $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
            self.destroy();
        });

        this.id = null;
        this.user = null;

        this.create = function (sessionId, user) {
            this.id = sessionId;
            this.user = user;
        };

        this.destroy = function () {
            this.id = null;
            this.user = null;
        };
    });
})();

app.factory('FullstackPics', function () {
    return ['https://pbs.twimg.com/media/B7gBXulCAAAXQcE.jpg:large', 'https://fbcdn-sphotos-c-a.akamaihd.net/hphotos-ak-xap1/t31.0-8/10862451_10205622990359241_8027168843312841137_o.jpg', 'https://pbs.twimg.com/media/B-LKUshIgAEy9SK.jpg', 'https://pbs.twimg.com/media/B79-X7oCMAAkw7y.jpg', 'https://pbs.twimg.com/media/B-Uj9COIIAIFAh0.jpg:large', 'https://pbs.twimg.com/media/B6yIyFiCEAAql12.jpg:large', 'https://pbs.twimg.com/media/CE-T75lWAAAmqqJ.jpg:large', 'https://pbs.twimg.com/media/CEvZAg-VAAAk932.jpg:large', 'https://pbs.twimg.com/media/CEgNMeOXIAIfDhK.jpg:large', 'https://pbs.twimg.com/media/CEQyIDNWgAAu60B.jpg:large', 'https://pbs.twimg.com/media/CCF3T5QW8AE2lGJ.jpg:large', 'https://pbs.twimg.com/media/CAeVw5SWoAAALsj.jpg:large', 'https://pbs.twimg.com/media/CAaJIP7UkAAlIGs.jpg:large', 'https://pbs.twimg.com/media/CAQOw9lWEAAY9Fl.jpg:large', 'https://pbs.twimg.com/media/B-OQbVrCMAANwIM.jpg:large', 'https://pbs.twimg.com/media/B9b_erwCYAAwRcJ.png:large', 'https://pbs.twimg.com/media/B5PTdvnCcAEAl4x.jpg:large', 'https://pbs.twimg.com/media/B4qwC0iCYAAlPGh.jpg:large', 'https://pbs.twimg.com/media/B2b33vRIUAA9o1D.jpg:large', 'https://pbs.twimg.com/media/BwpIwr1IUAAvO2_.jpg:large', 'https://pbs.twimg.com/media/BsSseANCYAEOhLw.jpg:large', 'https://pbs.twimg.com/media/CJ4vLfuUwAAda4L.jpg:large', 'https://pbs.twimg.com/media/CI7wzjEVEAAOPpS.jpg:large', 'https://pbs.twimg.com/media/CIdHvT2UsAAnnHV.jpg:large', 'https://pbs.twimg.com/media/CGCiP_YWYAAo75V.jpg:large', 'https://pbs.twimg.com/media/CIS4JPIWIAI37qu.jpg:large'];
});

app.factory('ProfileUpdater', function ($http, Session, $rootScope) {

    //wrpper for $http that automatucally broadcasts an event (so we don't have to keep calling it. Sly and DRY)
    var http = function http(method, url, body) {

        if ($rootScope.guestMode) {
            console.info("Guest mode is active. Using local storage");
            return localAction(method + url, body);
        }

        return $http[method.toLowerCase()](url, body).then(function (res) {
            return $rootScope.$broadcast('update-controller', res.data);
        }).catch(function (err) {
            return $rootScope.$broadcast('update-controller', err.data, true);
        });
    };
    var localAction = function localAction(action, payload) {
        console.log("getting a profile from local storage");
        var profile = JSON.parse(localStorage.getItem('profile'));
        console.log("the profile we got", profile);
        switch (action) {
            case 'PUT/api/user/tomatoMeter':
                profile.tomatoMeter.push(payload.tomato);
                if (payload.tomato.class === 'complete') profile.tomsToday++;
                break;
            case 'POST/api/user/tomatoMeter/archive':
                profile.archive.push({
                    date: Sd.convertSd(profile.sunDial),
                    tomatoMeter: profile.tomatoMeter
                });
                profile.tomatoMeter = [];
                profile.tomsToday = 0;
                profile.sunDial = Sd();
                break;
        }
        console.log("the new profile", profile);
        localStorage.setItem('profile', JSON.stringify(profile));
        $rootScope.$broadcast('update-controller', profile);
    };

    return {
        pushTomatoMeter: function pushTomatoMeter(tomato) {
            // stuff goes here
            console.log("what is the session anywho ??", Session);
            return http('PUT', '/api/user/tomatoMeter', {
                user: Session.user && Session.user._id, //TODO: remove and use the user on the req.body from backend
                tomato: tomato
            });
        },
        deleteTomatoMeter: function deleteTomatoMeter() {
            // deletes the current tomato meter of the day.
            return http('DELETE', '/api/user/tomatoMeter?user=' + Session.user._id);
            return $http.delete('/api/user/tomatoMeter?user=' + Session.user._id);
        },
        archiveTomatoMeter: function archiveTomatoMeter() {
            return http('POST', '/api/user/tomatoMeter/archive');
        }
    };
});

app.factory('RandomGreetings', function () {

    var getRandomFromArray = function getRandomFromArray(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    };

    var greetings = ['Hello, world!', 'At long last, I live!', 'Hello, simple human.', 'What a beautiful day!', 'I\'m like any other project, except that I am yours. :)', 'This empty string is for Lindsay Levine.', 'こんにちは、ユーザー様。', 'Welcome. To. WEBSITE.', ':D', 'Yes, I think we\'ve met before.', 'Gimme 3 mins... I just grabbed this really dope frittata', 'If Cooper could offer only one piece of advice, it would be to nevSQUIRREL!'];

    return {
        greetings: greetings,
        getRandomGreeting: function getRandomGreeting() {
            return getRandomFromArray(greetings);
        }
    };
});

app.factory('Store', function ($log) {

    //TODO: once users is implimented, the below defaultStore will only be retured if user is not logged in
    // this is the startng user state and will be modifed for as long as session is active. When a user signs up,
    // any progress from here will be passed to the user creation.

    var Store = {
        //TODO need to find a better way to update the store
        newRes: null,
        user: null,
        profile: {
            archive: [],
            tomsEaten: {
                today: 0,
                tomatoMeter: [],
                archive: [
                    //TODO: REMOVE on 8/25
                    //{date: Date, total: 0, tomatoMeter: {<tomatoMeter>} }
                ],
                getTotal: function getTotal() {
                    return Store.profile.tomsEaten.archive.map(function (t) {
                        return t.total;
                    }).reduce(function (p, n) {
                        return p + n;
                    }, Store.profile.tomsToday);
                }
            }
        },
        unlockedFeatures: [],
        features: [{ name: "goalSetter", unlockAt: 1, listener: "tomComplete" }, { name: "todo", unlockAt: 3, listener: "tomComplete" }, { name: "markFail", unlockAt: { daysComplete: 2 }, listener: "tomComplete" }, { name: "snake", unlockAt: 8, type: "game", listener: "tomComplete" }, { name: "playlist", unlockAt: { tomsToday: 8 }, listener: "tomComplete" }, { name: "goalSettor", unlockAt: { streak: 3 }, listener: "tomComplete" }, { name: "tetris", unlockAt: 44, type: "game", listener: "tomComplete" }, {
            name: "darkTheme",
            unlockAt: { daysComplete: 30 },
            unlockFn: function unlockFn() {
                return new Date().getHours() > 18;
            },
            listener: "tomComplete"
        }, { name: "1000tomsPage", unlockAt: 1000, listener: "tomComplete" }],
        getTotalToms: function getTotalToms(user) {
            return _.sum(user.archive.map(function (i) {
                return i.tomatoMeter.filter(function (t) {
                    return t.class === 'complete';
                }).length;
            })) + (user.tomsToday || 0);
            console.log("meter??? ", archiveTotals);
            return user.archive.reduce(function (p, tomatoSeries) {
                return tomatoSeries.tomatoMoter.reduce(function (p, t) {
                    return (t.class === 'complete' ? 1 : 0) + p;
                }, 0) + p;
            }, 0) + user.tomsToday || 0;
        },
        update: function update(newProps) {
            return;
            // move this somewhere else
            return $http.get('/session').then(function (res) {
                return $http.put('/api/user/', { newProps: newProps, user: res.data.user });
            }).then(function (user) {
                return console.log("new user data", user);
            }).catch(function (error) {
                return console.error("something went wrong", error);
            });
        },
        archiveTomsEaten: function archiveTomsEaten() {
            if (!Store.profile.tomsToday) {
                $log.info("nothing to archive. User not updated");
                return;
            }
            var tomInfo = {
                date: new Date(),
                total: Store.profile.tomsToday,
                tomatoMeter: Store.profile.tomsEaten.tomatoMeter.filter(function (t) {
                    return t.text !== "...";
                })
            };
            Store.profile.tomsEaten.tomatoMeter = [];
            var newArchive = [tomInfo].concat(Store.profile.tomsEaten.archive);
            return Store.updateProfile({ tomsEaten: { archive: newArchive } });
        }
    };

    // attach user to the store

    return Store;
});

/*
 unlockAt:
 Number - amount of total toms eaten
 Obj - different prop to unlock at:
 tomsComplete (defualt) - total toms eaten. Same as passing number
 tomsToday - number in a day.
 daysComplete: number of days a tom was eaten: OR obj
 streak: number days in a row that a tom was eaten.

 Feature listeners:
 "tomComplete" : when a pomodoro is sucessfully complete.
 "newDay" : when the app is opened on a new day.
 */

app.directive('fullstackLogo', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/fullstack-logo/fullstack-logo.html'
    };
});
app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state, $window) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            scope.items = [{ label: 'Pomodoro', state: 'home' }, { label: 'My Stuff', state: 'me', auth: true }, { label: 'Learn', state: 'learn' }, { label: 'About / Support', state: 'about' }];
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

            var setUser = function setUser() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function removeUser() {
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
                if ($state.current.name === 'login') return;
                $dropdown.toggleClass('opened');
            };
            var closeDropdown = function closeDropdown() {
                $dropdown.removeClass('opened');
            };
            $rootScope.$on('$stateChangeStart', closeDropdown);
            $rootScope.$on('$stateChangeSuccess', function () {
                $('#main').on('click', closeDropdown);
            });
        }

    };
});

app.directive('randoGreeting', function (RandomGreetings) {

    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/rando-greeting/rando-greeting.html',
        link: function link(scope) {
            scope.greeting = RandomGreetings.getRandomGreeting();
        }
    };
});
app.directive('splashScreen', function () {
    return {
        restrict: 'E',
        template: '<div id="splash-screen"><div id="loading-content">{{loadingText}}</div></div>',
        link: function link(scope, ele) {

            scope.loadingText = "Loading";
            var interval = setInterval(function () {
                var append = scope.loadingText + " .";
                if (append.length > 14) append = "Loading";
                scope.loadingText = append;
                scope.$digest();
            }, 400);

            var splashTimer = setInterval(function () {
                if (!window.ready) return;
                // delete window.ready;
                clearInterval(interval);
                clearInterval(splashTimer);
                ele.remove();
            }, 2000 + Math.round(Math.random() * 500));
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFib3V0L2Fib3V0LmpzIiwibGVhcm4vbGVhcm4uanMiLCJsb2dpbi9sb2dpbi5qcyIsIm15LXN0dWZmL215LXN0dWZmLmpzIiwiaG9tZS9ob21lLmpzIiwiZG9jcy9kb2NzLmpzIiwiZnNhL2ZzYS1wcmUtYnVpbHQuanMiLCJjb21tb24vZmFjdG9yaWVzL0Z1bGxzdGFja1BpY3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1Byb2ZpbGVVcGRhdGVyLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1N0b3JlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZnVsbHN0YWNrLWxvZ28vZnVsbHN0YWNrLWxvZ28uanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvcmFuZG8tZ3JlZXRpbmcvcmFuZG8tZ3JlZXRpbmcuanMiLCJjb21tb24vZGlyZWN0aXZlcy9zcGxhc2gtc2NyZWVuL3NwbGFzaC1zY3JlZW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUEsYUFBQSxpQkFBQTs7QUFFQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsSUFBQSxNQUFBLENBQUEsVUFBQSxrQkFBQSxFQUFBLGlCQUFBLEVBQUE7QUFDQTtBQUNBLHNCQUFBLFNBQUEsQ0FBQSxJQUFBO0FBQ0E7QUFDQSx1QkFBQSxTQUFBLENBQUEsR0FBQTtBQUNBO0FBQ0EsdUJBQUEsSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBLGVBQUEsUUFBQSxDQUFBLE1BQUE7QUFDQSxLQUZBO0FBR0EsQ0FUQTs7QUFXQTtBQUNBLElBQUEsR0FBQSxDQUFBLFVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQSxF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QUVBLFFBQUEsVUFBQSxTQUFBLE9BQUE7QUFBQSxlQUFBLE9BQUEsSUFBQSxJQUFBLGlCQUFBO0FBQUEsS0FBQTs7QUFFQSxXQUFBLFlBQUEsR0FBQTtBQUFBLGVBQUEsU0FBQTtBQUFBLEtBQUE7QUFDQSxXQUFBLFFBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQSxNQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUE7QUFDQSxLQUZBOztBQUlBOzs7QUFHQSxXQUFBLElBQUEsR0FBQSxNQUFBO0FBQ0E7QUFDQSxRQUFBLFlBQUEsT0FBQSxXQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsSUFBQSxDQUFBOztBQUVBLFdBQUEsWUFBQSxHQUFBLFVBQUEsYUFBQSxFQUFBO0FBQ0EseUJBQUEsTUFBQSxVQUFBLEVBQUE7QUFFQSxLQUhBOztBQUtBLFdBQUEsVUFBQSxHQUFBLFlBQUE7QUFBQSxZQUFBLElBQUEseURBQUEsQ0FBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBO0FBQUEsWUFBQSxVQUFBO0FBQUEsWUFBQSxVQUFBOztBQUNBLHFCQUFBLGNBQUEsWUFBQTtBQUNBO0FBQ0EsZ0JBQUEsTUFBQSxLQUFBLEtBQUEsVUFBQSxFQUFBLFNBQUEsS0FBQSxHQUFBLE9BQUEsT0FBQSxJQUFBLEdBQUEsTUFBQSxPQUFBLEtBQUEsR0FBQSxHQUFBLE1BQUEsT0FBQSxFQUFBLElBQUEsTUFBQSxHQUFBLFNBQUE7QUFDQSxnQkFBQSxNQUFBLEtBQUEsS0FBQSxPQUFBLElBQUEsTUFBQSxLQUFBLEtBQUEsWUFBQSxFQUFBLFNBQUEsS0FBQSxHQUFBLE9BQUEsT0FBQSxJQUFBLEdBQUEsTUFBQSxPQUFBLEtBQUEsR0FBQSxHQUFBLE1BQUEsT0FBQSxFQUFBLElBQUEsV0FBQTtBQUNBLG1CQUFBLE9BQUE7QUFDQSxTQUxBO0FBTUEsZ0JBQUEsR0FBQSxDQUFBLGNBQUEsRUFBQSxVQUFBO0FBQ0EsY0FBQSxVQUFBO0FBQ0EsZ0JBQUEsSUFBQSxLQUFBLENBQUEsSUFBQSxFQUFBLFVBQUEsRUFBQSxVQUFBLENBQUE7QUFDQSxZQUFBLE1BQUEs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QUEseURBRkE7QUFHQSxjQUFBLGNBQUEsS0FBQSxFQUFBO0FBQ0Esa0JBQUEsUUFBQSxHQUFBLGdCQUFBLGlCQUFBLEVBQUE7QUFDQTtBQUxBLEtBQUE7QUFRQSxDQVZBO0FDQUEsSUFBQSxTQUFBLENBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQSxXQUFBO0FBQ0Esa0JBQUEsR0FEQTtBQUVBLGtCQUFBLCtFQUZBO0FBR0EsY0FBQSxjQUFBLEtBQUEsRUFBQSxHQUFBLEVBQUE7O0FBRUEsa0JBQUEsV0FBQSxHQUFBLFNBQUE7QUFDQSxnQkFBQSxXQUFBLFlBQUEsWUFBQTtBQUNBLG9CQUFBLFNBQUEsTUFBQSxXQUFBLEdBQUEsSUFBQTtBQUNBLG9CQUFBLE9BQUEsTUFBQSxHQUFBLEVBQUEsRUFBQSxTQUFBLFNBQUE7QUFDQSxzQkFBQSxXQUFBLEdBQUEsTUFBQTtBQUNBLHNCQUFBLE9BQUE7QUFDQSxhQUxBLEVBS0EsR0FMQSxDQUFBOztBQU9BLGdCQUFBLGNBQUEsWUFBQSxZQUFBO0FBQ0Esb0JBQUEsQ0FBQSxPQUFBLEtBQUEsRUFBQTtBQUNBO0FBQ0EsOEJBQUEsUUFBQTtBQUNBLDhCQUFBLFdBQUE7QUFDQSxvQkFBQSxNQUFBO0FBQ0EsYUFOQSxFQU1BLE9BQUEsS0FBQSxLQUFBLENBQUEsS0FBQSxNQUFBLEtBQUEsR0FBQSxDQU5BLENBQUE7QUFRQTtBQXJCQSxLQUFBO0FBdUJBLENBeEJBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbk5vdGlmaWNhdGlvbi5yZXF1ZXN0UGVybWlzc2lvbigpO1xuXG53aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ0Z1bGxzdGFja0dlbmVyYXRlZEFwcCcsIFsnZnNhUHJlQnVpbHQnLCAndWkucm91dGVyJywgJ3VpLmJvb3RzdHJhcCcsICduZ0FuaW1hdGUnXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbiAgICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAgICR1cmxSb3V0ZXJQcm92aWRlci53aGVuKCcvYXV0aC86cHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9KTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGNvbnRyb2xsaW5nIGFjY2VzcyB0byBzcGVjaWZpYyBzdGF0ZXMuXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlLCAkaHR0cCkge1xuXG4gICAgJGh0dHAuZ2V0KCcvYXBpL3Byb2R1Y3Rpb24nKS50aGVuKHJlcyA9PiB7XG4gICAgICAgIHdpbmRvdy5wcm9kdWN0aW9uID0gcmVzLnN0YXR1cyA9PT0gMjAxO1xuICAgICAgICB3aW5kb3cucmVhZHkgPSB0cnVlO1xuICAgICAgICBpZih3aW5kb3cucHJvZHVjdGlvbikge1xuICAgICAgICAgICAgdmFyIG5pbEZuID0gZnVuY3Rpb24oKSB7fTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nID0gbmlsRm47XG4gICAgICAgICAgICBjb25zb2xlLmluZm8gPSBuaWxGbjtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybiA9IG5pbEZuO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvciA9IG5pbEZuO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlO1xuICAgIH07XG5cbiAgICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAgIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMpIHtcblxuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAvLyBSZWdpc3RlciBvdXIgKmFib3V0KiBzdGF0ZS5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnYWJvdXQnLCB7XG4gICAgICAgIHVybDogJy9hYm91dCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdBYm91dENvbnRyb2xsZXInLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2Fib3V0L2Fib3V0Lmh0bWwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignQWJvdXRDb250cm9sbGVyJywgZnVuY3Rpb24gKCRzY29wZSwgRnVsbHN0YWNrUGljcykge1xuXG4gICAgLy8gSW1hZ2VzIG9mIGJlYXV0aWZ1bCBGdWxsc3RhY2sgcGVvcGxlLlxuICAgICRzY29wZS5pbWFnZXMgPSBfLnNodWZmbGUoRnVsbHN0YWNrUGljcyk7XG5cbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xlYXJuJywge1xuICAgICAgICB1cmw6ICcvbGVhcm4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJy9qcy9sZWFybi9sZWFybi5odG1sJyxcbiAgICB9KVxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsICRyb290U2NvcGUsICR3aW5kb3cpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuZ29CYWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAkd2luZG93Lmhpc3RvcnkuYmFjaygpO1xuICAgIH1cblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oXCJzZXR0aW5nIGd1ZXN0IG1vZGUgdG8gZmFsc2UgXCIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS5ndWVzdE1vZGUgPSBmYWxzZTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWUnLCB7XG4gICAgICAgIHVybDogJy9tZScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnL2pzL215LXN0dWZmL215LXN0dWZmLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnbXlTdHVmZicsXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgZGF0YS5hdXRoZW50aWNhdGUgaXMgcmVhZCBieSBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgICAvLyB0aGF0IGNvbnRyb2xzIGFjY2VzcyB0byB0aGlzIHN0YXRlLiBSZWZlciB0byBhcHAuanMuXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIGF1dGhlbnRpY2F0ZTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgICAgICB1c2VyOiBmdW5jdGlvbiAoU3RvcmUsIEF1dGhTZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgaWYoU3RvcmUudXNlcikgcmV0dXJuIFN0b3JlLnVzZXI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKHVzZXIgPT4gdXNlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdteVN0dWZmJywgZnVuY3Rpb24gKCRzY29wZSwgdXNlcikge1xuICAgIGNvbnNvbGUubG9nKFwiIyMjIyNcIiAsIHVzZXIpO1xuICAgICRzY29wZS5hcmNoaXZlID0gdXNlci5hcmNoaXZlLnNsaWNlKCkucmV2ZXJzZSgpO1xufSk7XG5cbmFwcC5mYWN0b3J5KCdTZWNyZXRTdGFzaCcsIGZ1bmN0aW9uICgkaHR0cCkge1xuXG4gICAgdmFyIGdldFN0YXNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL21lbWJlcnMvc2VjcmV0LXN0YXNoJykudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2V0U3Rhc2g6IGdldFN0YXNoXG4gICAgfTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9ob21lL2hvbWUuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdIb21lQ3RybCcsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgIHVzZXI6IGZ1bmN0aW9uIChBdXRoU2VydmljZSwgJHJvb3RTY29wZSwgU3RvcmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4odXNlciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlVTRVIgU1RBVFVTU1NTIFwiLCB1c2VyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIHVzZXIsIGRvaW5nIGxvY2FsIHByb2ZpbGVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLmd1ZXN0TW9kZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9jYWxQcm9maWxlID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJwcm9maWxlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsUHJvZmlsZSkgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxQcm9maWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhcIm5vIGxvY2FsIHByb2ZpbGUsIGNyZWF0aW5nIG9uZSFcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdMb2NhbFByb2ZpbGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9tc1RvZGF5OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvbWF0b01ldGVyOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW5EaWFsOiBTZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyY2hpdmU6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVubG9ja2VkRmVhdHVyZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RMb2dnZWRJbjogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGd1ZXN0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwicHJvZmlsZVwiLCBKU09OLnN0cmluZ2lmeShuZXdMb2NhbFByb2ZpbGUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdMb2NhbFByb2ZpbGU7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvZmlsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN0YXR1czogMTAwIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignSG9tZUN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBTdG9yZSwgcHJvZmlsZSwgdXNlciwgUHJvZmlsZVVwZGF0ZXIpIHtcbiAgICBjb25zb2xlLmxvZyhcInRoZSB1c2VyOiBcIiwgdXNlcik7XG4gICAgJHNjb3BlLnByb2R1Y3Rpb24gPSB3aW5kb3cucHJvZHVjdGlvbjtcblxuICAgIGlmIChwcm9maWxlLnN0YXR1cyA9PT0gMjAyKSB7XG4gICAgICAgIFN0b3JlLmFyY2hpdmVUb21zRWF0ZW4oKTtcbiAgICB9XG5cbiAgICAkc2NvcGUudXBkYXRlQ29udHJvbGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAudGhlbihuZXdVc2VyID0+IHtcbiAgICAgICAgICAgICAgICB1c2VyID0gbmV3VXNlcjtcbiAgICAgICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICAgICAgfSlcbiAgICB9O1xuICAgICRzY29wZS4kb24oJ3VwZGF0ZS1jb250cm9sbGVyJywgZnVuY3Rpb24gKGV2ZW50LCBuZXdVc2VyLCBlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYW4gZXJyb3IgaGFwcGVuZWQhISEhIVwiLCBuZXdVc2VyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmluZm8oXCJbSG9tZUN0cmxdIGB1cGRhdGUtY29udHJvbGxlcmAgdHJpZ2dlcmVkXCIsIG5ld1VzZXIpO1xuICAgICAgICB1c2VyID0gbmV3VXNlcjtcbiAgICAgICAgJHNjb3BlLnRvbWF0b01ldGVyID0gdXNlci50b21hdG9NZXRlci5jb25jYXQoe2NsYXNzOiAnd2FpdCcsIHRleHQ6IFwiLi4uXCJ9KTtcbiAgICAgICAgYWN0aXZlSWR4ID0gJHNjb3BlLnRvbWF0b01ldGVyLmxlbmd0aCAtIDE7XG4gICAgICAgIGNvbXBsZXRlZCA9IHVzZXIudG9tc1RvZGF5IHx8IDA7XG4gICAgICAgIC8vICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgIC8vICRzY29wZS51cGRhdGVDb250cm9sbGVyKCk7XG4gICAgfSk7XG5cbiAgICAvLyBhc3NpZ24gY3VycmVudCBzdGF0cyB0byBwaWNrIHVwIHdoZXJlIHdlIGxlZnQgb2ZmLlxuICAgICRzY29wZS5pc0d1ZXN0ID0gdXNlci5pc0d1ZXN0O1xuICAgICRzY29wZS50b21hdG9NZXRlciA9IHVzZXIudG9tYXRvTWV0ZXIuY29uY2F0KHtjbGFzczogJ3dhaXQnLCB0ZXh0OiBcIi4uLlwifSk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IHVzZXIudG9tc1RvZGF5IHx8IDA7XG5cbiAgICAvLyBzdHVmZiB0aGF0IGhhcyBhIGxpZmVjeWNsZVxuICAgICRzY29wZS5zdGF0ZSA9IHtcbiAgICAgICAgc3RhdGU6IFwiT0ZGXCIsXG4gICAgICAgIHRpbWVyUnVubmluZzogZmFsc2UsXG4gICAgICAgIHRpbWVyUGF1c2VkOiBmYWxzZSxcbiAgICAgICAgb25CcmVhazogZmFsc2UsXG4gICAgICAgIGVkaXRpbmc6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBcIlwiLFxuICAgICAgICBzdGFuZGJ5VGltZXI6IG51bGwsXG4gICAgICAgIGJyZWFrVGltZXI6IG51bGwsXG4gICAgfTtcbiAgICBsZXQgc3RhdGUgPSAkc2NvcGUuc3RhdGU7IC8vIGZvciBiZXR0ZXIgcmVhZGFiaWxpdHkuXG4gICAgdmFyIHRpbWVyID0ge2NsZWFyVGltZXI6ICgpID0+IG51bGx9OyAvLyB0byBwcmV2ZW50IGludm9raW5nIHRoZSBmdW5jdGlvbiBvbiBhbiB1bmRlZmluZWQgb24gZmlyc3QgY2FsbDtcbiAgICBsZXQgdGl0bGVDYWNoZTtcblxuICAgIGxldCBnZXRHb2FsID0gKCkgPT4gJHNjb3BlLmdvYWwgfHwgXCJlYXRpbmcgYSB0b21hdG9cIjtcblxuICAgICRzY29wZS5nZXRDb21wbGV0ZWQgPSAoKSA9PiBjb21wbGV0ZWQ7XG4gICAgJHNjb3BlLmdldFRvdGFsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gU3RvcmUuZ2V0VG90YWxUb21zKHVzZXIpO1xuICAgIH1cblxuICAgIC8vICRzY29wZS5nb2FsID0gXCJcIjtcblxuXG4gICAgJHNjb3BlLnRpbWUgPSBcIjA6MDBcIjtcbiAgICAvLyAkc2NvcGUuc3RhdGUub25CcmVhayA9ICgpID0+ICRzY29wZS5zdGF0ZS5vbkJyZWFrO1xuICAgIGxldCBhY3RpdmVJZHggPSAoJHNjb3BlLnRvbWF0b01ldGVyLmxlbmd0aCAtIDEpIHx8IDA7XG5cbiAgICAkc2NvcGUuc3RhcnRJbml0aWFsID0gZnVuY3Rpb24gKGRvbnRTdG9wVGltZXIpIHtcbiAgICAgICAgZG9udFN0b3BUaW1lciB8fCB0aW1lci5jbGVhclRpbWVyKCk7XG5cbiAgICB9XG5cbiAgICAkc2NvcGUuc3RhcnRUaW1lciA9IGZ1bmN0aW9uICh0aW1lID0gWzI1LCAwXSwgY29tcGxldGVGbiwgaW50ZXJ2YWxGbikge1xuICAgICAgICBpbnRlcnZhbEZuID0gaW50ZXJ2YWxGbiB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gYXNzaWduIHNjb3BlIGFuZCBkb2N1bWVudCB0aXRsZSBpbiBvbmUgZ29cbiAgICAgICAgICAgICAgICBpZihzdGF0ZS5zdGF0ZSA9PT0gXCJQT01PQk9ST1wiKSBkb2N1bWVudC50aXRsZSA9IFwiW1wiICsgKCRzY29wZS50aW1lID0gdGltZXIuZ2V0TWlucygpICsgXCI6XCIgKyB0aW1lci5nZXRTZWNzKCkpICsgXCJdIMKrIFwiICsgZ2V0R29hbCgpO1xuICAgICAgICAgICAgICAgIGlmKHN0YXRlLnN0YXRlID09PSBcIkJSRUFLXCIgfHwgc3RhdGUuc3RhdGUgPT09IFwiTE9OR19CUkVBS1wiKSBkb2N1bWVudC50aXRsZSA9IFwiW1wiICsgKCRzY29wZS50aW1lID0gdGltZXIuZ2V0TWlucygpICsgXCI6XCIgKyB0aW1lci5nZXRTZWNzKCkpICsgXCJdIMKrIEJSRUFLXCI7XG4gICAgICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIGNvbnNvbGUubG9nKFwiSU5URVJWQUwgRk4gXCIsICBpbnRlcnZhbEZuKTtcbiAgICAgICAgdGltZXIuY2xlYXJUaW1lcigpXG4gICAgICAgIHRpbWVyID0gbmV3IFRpbWVyKHRpbWUsIGNvbXBsZXRlRm4sIGludGVydmFsRm4pO1xuICAgICAgICBpZihzdGF0ZS5zdGF0ZSA9PT0gXCJQT01PRE9ST1wiKSBkb2N1bWVudC50aXRsZSA9IFwiW1wiICsgKCRzY29wZS50aW1lID0gXCIyNTowMFwiKSArIFwiXSDCqyBcIiArIGdldEdvYWwoKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLnN0YXJ0UG9tb2Rvcm8gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN0YXRlLnN0YXRlID0gXCJudWxsXCI7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gc3RhdGUuc3RhdGUgPSAnUE9NT0RPUk8nLCAxMDAwKTtcbiAgICAgICAgc3RhdGUudGltZXJSdW5uaW5nID0gdHJ1ZTtcblxuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZVRvbS5jbGFzcyA9ICdhY3RpdmUnO1xuICAgICAgICBhY3RpdmVUb20udGV4dCA9IGNvbXBsZXRlZCArIDE7XG5cbiAgICAgICAgbGV0IGNvbXBsZXRlRm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuaGlkZGVuKSBuZXcgTm90aWZpY2F0aW9uKFwiUG9tb2Rvcm8gY29tcGxldGVcIiwge1xuICAgICAgICAgICAgICAgIGJvZHk6IFwiVGFrZSBhIDUgbWludXRlIGJyZWFrIG9yIHNlbGVjdCBvdGhlciBvcHRpb25zXCIsXG4gICAgICAgICAgICAgICAgaWNvbjogXCIvcHVibGljL3RvbWF0by5wbmdcIlxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAkc2NvcGUuX21hcmtDb21wbGV0ZSgpO1xuICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgICAgIHJldHVybiAkc2NvcGUuc3RhcnRCcmVhayhbNSwwXSk7XG4gICAgICAgIH07XG4gICAgICAgIGxldCBpbnRlcnZhbEZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gYXNzaWduIHNjb3BlIGFuZCBkb2N1bWVudCB0aXRsZSBpbiBvbmUgZ29cbiAgICAgICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJbXCIgKyAoJHNjb3BlLnRpbWUgPSB0aW1lci5nZXRNaW5zKCkgKyBcIjpcIiArIHRpbWVyLmdldFNlY3MoKSkgKyBcIl0gwqsgXCIgKyBnZXRHb2FsKCk7XG4gICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICB9O1xuICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJGb2N1cyB0aW1lIVwiO1xuICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwiW1wiICsgKCRzY29wZS50aW1lID0gXCIyNTowMFwiKSArIFwiXSDCqyBcIiArIGdldEdvYWwoKTtcbiAgICAgICAgJHNjb3BlLnN0YXJ0VGltZXIoWzI1LDBdLCBjb21wbGV0ZUZuLCBpbnRlcnZhbEZuKVxuICAgIH07XG5cbiAgICAkc2NvcGUuc3RhcnRCcmVhayA9IGZ1bmN0aW9uICh0aW1lID0gWzUsMF0pIHtcbiAgICAgICAgc3RhdGUuc3RhdGUgPSAnbnVsbCc7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gc3RhdGUuc3RhdGUgPSAnQlJFQUsnLCAxMDAwKTtcbiAgICAgICAgc3RhdGUudGltbWVyUnVubmluZyA9IGZhbHNlO1xuICAgICAgICBzdGF0ZS5vbkJyZWFrID0gdHJ1ZTtcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9IFwiWW91J3JlIG9uIGEgYnJlYWshIFlvdSBjYW4gdHVybiB0aGlzIGludG8gYSBsb25nIGJyZWFrIG9yIHN0YXJ0IGEgbmV3IFBvbW9kb3JvIHdpdGggdGhlIGJ1dHRvbnMgYmVsb3cuXCI7XG4gICAgICAgIGxldCBjb21wbGV0ZUZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmhpZGRlbikgbmV3IE5vdGlmaWNhdGlvbihcIkJyZWFrIG92ZXIhXCIsIHtcbiAgICAgICAgICAgICAgICBib2R5OiBcIlN0YXJ0IGFub3RoZXIgcG9tb2Rvcm8sIG9yIHRha2UgYSBsb25nIGJyZWFrLlwiLFxuICAgICAgICAgICAgICAgIGljb246IFwiL3B1YmxpYy90b21hdG8ucG5nXCJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgJHNjb3BlLnBvc3RCcmVhaygpO1xuICAgICAgICB9O1xuICAgICAgICAkc2NvcGUuc3RhcnRUaW1lcih0aW1lLCBjb21wbGV0ZUZuKTtcbiAgICB9O1xuICAgICRzY29wZS5wb3N0QnJlYWsgPSBmdW5jdGlvbiAodGltZSA9IFsxLCAzMF0pIHtcbiAgICAgICAgc3RhdGUuc3RhdGUgPSAnbnVsbCc7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gc3RhdGUuc3RhdGUgPSBcIlBPU1RfQlJFQUtcIiwxMDAwKTtcbiAgICAgICAgbGV0IGZvcmNlQnJlYWtGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5zdGFydExvbmdCcmVhayhbMTMsMzBdLCB0cnVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9IFwiU2VsZWN0IHdoYXQgdG8gZG8gbmV4dC4gV2Ugd2lsbCBzdGFydCBhIGJyZWFrIGluIDE6MzBcIjtcbiAgICAgICAgc3RhdGUudGltZXJSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRpbWVyID0gbmV3IFRpbWVyKHRpbWUsZm9yY2VCcmVha0ZuLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc3RhbmRieVRpbWUgPSB0aW1lci5nZXRNaW5zKCkgKyBcIjpcIiArIHRpbWVyLmdldFNlY3MoKTtcbiAgICAgICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBcIlNlbGVjdCB3aGF0IHRvIGRvIG5leHQuIFRoaXMgYXV0b21hdGljYWxseSBiZWNvbWVzIGEgbG9uZyBicmVhayBpbiBcIiArIHN0YW5kYnlUaW1lO1xuICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAkc2NvcGUuc3RhcnRMb25nQnJlYWsgPSBmdW5jdGlvbiAodGltZSA9IFsxNSwgMF0sIGZvcmNlZCkge1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9IFwiTE9OR19CUkVBS1wiO1xuICAgICAgICAkc2NvcGUuX21hcmtMb25nQnJlYWtTdGFydCgpO1xuICAgICAgICBzdGF0ZS5tZXNzYWdlID0gZm9yY2VkID8gXCJZb3UndmUgYmVlbiBpZGxlIGZvciBhIHdoaWxlLiBTbyB3ZSd2ZSBtYWRlIHRoaXMgYSBsb25nIGJyZWFrXCJcbiAgICAgICAgICAgIDogXCJSZWxheCBmb3IgYSB3aGlsZSwgb3Igc3RhcnQgYW5vdGhlciBQb21vZG9ybyBpZiB5b3UncmUgcmVhZHkuXCI7XG4gICAgICAgICRzY29wZS5zdGFydFRpbWVyKHRpbWUgLGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAkc2NvcGUuX21hcmtMb25nQnJlYWtDb21wbGV0ZSgpO1xuICAgICAgICAgICAgJHNjb3BlLnBvc3RCcmVhaygpXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAkc2NvcGUuc3RvcEN1cnJlbnRUaW1lciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGltZXIuY2xlYXJJbnRlcnZhbCgpO1xuICAgIH07XG5cblxuXG4gICAgJHNjb3BlLnRvZ2dsZVBhdXNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRpbWVyKSAgcmV0dXJuO1xuXG4gICAgICAgIHRpbWVyLnRvZ2dsZVBhdXNlKCk7XG4gICAgICAgIHN0YXRlLnRpbWVyUGF1c2VkID0gIXN0YXRlLnRpbWVyUGF1c2VkO1xuICAgICAgICBpZiAoIXRpdGxlQ2FjaGUpIHtcbiAgICAgICAgICAgIHRpdGxlQ2FjaGUgPSBkb2N1bWVudC50aXRsZTtcbiAgICAgICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCLilpDilpAgXCIgKyBkb2N1bWVudC50aXRsZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LnRpdGxlID0gdGl0bGVDYWNoZTtcbiAgICAgICAgICAgIHRpdGxlQ2FjaGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG5cbiAgICAvLy8vIElOVEVSTkFMIExPR0lDIC8vL1xuICAgIC8vIFRPRE8gdGhpcyBzdHVmZiBzaG91bGQgYmUgbW92ZWQgb2ZmIHRoZSBzY29wZSBhbmQgcHV0IGludG8gYXByb3ByaWF0ZSB0aW1lb3V0cy5cblxuICAgICRzY29wZS5fbWFya0NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIC8vIG1hcmsgdGhlIHBlbmRpbmcgdG9tIGNvbXBsZXRlXG4gICAgICAgIGFjdGl2ZVRvbS50ZXh0ID0gY29tcGxldGVkICsgMTsgLy9mb3IgaHVtYW4gcmVhZGJsZSAxLWluZGV4aW5nXG4gICAgICAgIGFjdGl2ZVRvbS5jbGFzcyA9ICdjb21wbGV0ZSc7XG5cbiAgICAgICAgY29tcGxldGVkKys7XG4gICAgICAgIGFjdGl2ZUlkeCsrO1xuICAgICAgICAvLyAkc2NvcGUudG9tYXRvTWV0ZXIucHVzaCh7Y2xhc3M6ICd3YWl0JywgdGV4dDogJy4uLid9KVxuXG4gICAgICAgIFByb2ZpbGVVcGRhdGVyLnB1c2hUb21hdG9NZXRlcihhY3RpdmVUb20pO1xuICAgICAgICAvLyAudGhlbihyZXMgPT4gY29uc29sZS5pbmZvKFwiW2hvbWUuanM6bWFya0NvcGxldGVdIHVzZXIgcHJvZmlsZSB1cGRhdGVkXCIsIHJlcykpO1xuICAgICAgICAvLyBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi50b2RheSsrO1xuICAgIH07XG5cbiAgICAkc2NvcGUuX21hcmtMb25nQnJlYWtTdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV0IGFjdGl2ZVRvbSA9ICRzY29wZS50b21hdG9NZXRlclthY3RpdmVJZHhdO1xuICAgICAgICBhY3RpdmVUb20udGV4dCA9IFwiI2JyZWFrI1wiO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSAnYnJlYWsnO1xuICAgICAgICAkc2NvcGUuc3RhdGUub25CcmVhayA9IHRydWU7XG4gICAgfTtcbiAgICAkc2NvcGUuX21hcmtMb25nQnJlYWtDb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIlBvbW9kb3JvIVwiO1xuICAgICAgICAkc2NvcGUudGltZSA9IFwiMDowMFwiO1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZUlkeCsrO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSBcImJyZWFrIGNvbXBsZXRlXCI7XG4gICAgICAgIFByb2ZpbGVVcGRhdGVyLnB1c2hUb21hdG9NZXRlcihhY3RpdmVUb20pO1xuICAgIH07XG4gICAgJHNjb3BlLl9tYXJrRmFpbGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZighY29uZmlybShcIk1hcmsgcG9tb2Rvcm8gYXMgZmFpbGVkP1wiKSkgcmV0dXJuO1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9ICdudWxsJztcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9ICdNYXJraW5nIGZhaWxlZC4uLic7XG4gICAgICAgICRzY29wZS5nb2FsID0gJyc7XG4gICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJQb21vZG9ybyFcIjtcbiAgICAgICAgJHNjb3BlLnRpbWUgPSBcIjooXCI7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgc3RhdGUuc3RhdGUgPSAnT0ZGJztcbiAgICAgICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBcIlN0YXJ0IGEgbmV3IHBvbW9kb3JvIHdoZW4gcmVhZHkuXCI7XG4gICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICB9LDEwMDApO1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZUlkeCsrO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSAnZmFpbCc7XG4gICAgICAgIGFjdGl2ZVRvbS50ZXh0ID0gJ1gnO1xuICAgICAgICBQcm9maWxlVXBkYXRlci5wdXNoVG9tYXRvTWV0ZXIoYWN0aXZlVG9tKTtcbiAgICAgICAgdGltZXIuY2xlYXJUaW1lcigpO1xuICAgIH07XG5cbiAgICAkc2NvcGUuZGVsZXRlVG9tYXRvTWV0ZXIgPSBQcm9maWxlVXBkYXRlci5kZWxldGVUb21hdG9NZXRlcjtcbiAgICAkc2NvcGUuYXJjaGl2ZVRvbWF0b01ldGVyID0gUHJvZmlsZVVwZGF0ZXIuYXJjaGl2ZVRvbWF0b01ldGVyO1xuXG5cbiAgICBsZXQgJGlucHV0R29hbCA9ICQoJ2lucHV0LmdvYWwnKSxcbiAgICAgICAgJHBsYWNlaG9sZGVyID0gJCgnI3BsYWNlaG9sZGVyJyksXG4gICAgICAgICRnb2FsSW5wdXQgPSAkKCcjZ29hbElucHV0Jyk7XG5cbiAgICAkc2NvcGUudG9nZ2xlRWRpdCA9ICgpID0+IHtcbiAgICAgICAgJHBsYWNlaG9sZGVyLmhpZGUoKTtcbiAgICAgICAgJGdvYWxJbnB1dC5zaG93KCk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dvYWxJbnB1dCcpLmZvY3VzKCksIDApO1xuICAgIH07XG4gICAgJGdvYWxJbnB1dC5ibHVyKCgpID0+IHtcbiAgICAgICAgaWYgKCEkc2NvcGUuZ29hbCkge1xuICAgICAgICAgICAgJGdvYWxJbnB1dC5oaWRlKCk7XG4gICAgICAgICAgICAkcGxhY2Vob2xkZXIuc2hvdygpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgJGdvYWxJbnB1dC5rZXlwcmVzcyhlID0+IHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZmluaXNoIGVkaXRcIik7XG4gICAgICAgICAgICAkaW5wdXRHb2FsLmJsdXIoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIC8vdG9tYXRvIGJ1dHRvbiBjb250cm9sc1xuICAgIHNldFRpbWVvdXQoJHNjb3BlLiRkaWdlc3QpO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdkb2NzJywge1xuICAgICAgICB1cmw6ICcvZG9jcycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvZG9jcy9kb2NzLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTLCBTdG9yZSkge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEsIFN0b3JlKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJvbiBzdWNycnJycmVzc3MgcmVzIDogXCIsIHJlc3BvbnNlKVxuICAgICAgICAgICAgU3RvcmUubmV3UmVzID0gcmVzcG9uc2U7XG4gICAgICAgICAgICBjaGVja0ZvckxvY2FsU3RvcmFnZShyZXNwb25zZSlcblxuICAgICAgICAgICAgdmFyIGRhdGEgPSBTdG9yZS5uZXdSZXMuZGF0YTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibmV3IGRhaHRhYWEgXCIsIGRhdGEpO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUoZGF0YS5pZCwgZGF0YS51c2VyKTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgcHJvZmlsZSB0byB0aGUgc3RvcmUgZmFjdG9yeSwgd2hpY2ggd2lsbCBjb250aW51ZSB0byB1cGRhdGUgdGhlIHVzZXIgZGF0YVxuICAgICAgICAgICAgLy8gU3RvcmUucHJvZmlsZSA9IGRhdGEudXNlci5wcm9maWxlO1xuICAgICAgICAgICAgU3RvcmUucHJvZmlsZSA9IGRhdGEudXNlcjtcbiAgICAgICAgICAgIFN0b3JlLnVzZXIgPSBkYXRhLnVzZXIgJiYgZGF0YS51c2VyLmlkO1xuICAgICAgICAgICAgJHJvb3RTY29wZS5ndWVzdE1vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEudXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcbiAgICAgICAgZnVuY3Rpb24gY2hlY2tGb3JMb2NhbFN0b3JhZ2UocmVzcG9uc2VUb1Bhc3MpIHtcbiAgICAgICAgICAgIHZhciBsb2NhbFByb2ZpbGUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgncHJvZmlsZScpO1xuICAgICAgICAgICAgaWYobG9jYWxQcm9maWxlKXtcbiAgICAgICAgICAgICAgICBsb2NhbFByb2ZpbGUgPSBKU09OLnBhcnNlKGxvY2FsUHJvZmlsZSk7XG4gICAgICAgICAgICAgICAgLy8gbWVyZ2UgbG9jYWwgcHJvZmlsZVxuICAgICAgICAgICAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvdXNlci9sb2NhbFByb2ZpbGUnLCB7bG9jYWxQcm9maWxlfSApXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKG5ld1Jlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVEhFIE5FVyBSRVNPUE9TRUVFRUVcIiwgbmV3UmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIG5ld1Jlc3BvbnNlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncHJvZmlsZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUubmV3UmVzID0gbmV3UmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3UmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHJldHVybiAoU3RvcmUubmV3UmVzID0gcmVzcG9uc2VUb1Bhc3MpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJywge2xvZ2luVGltZTogbmV3IERhdGUoKX0pLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3Qoe21lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLid9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gc2Vzc2lvbklkO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSkoKTtcbiIsImFwcC5mYWN0b3J5KCdGdWxsc3RhY2tQaWNzJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBbXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjdnQlh1bENBQUFYUWNFLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL2ZiY2RuLXNwaG90b3MtYy1hLmFrYW1haWhkLm5ldC9ocGhvdG9zLWFrLXhhcDEvdDMxLjAtOC8xMDg2MjQ1MV8xMDIwNTYyMjk5MDM1OTI0MV84MDI3MTY4ODQzMzEyODQxMTM3X28uanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLUxLVXNoSWdBRXk5U0suanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNzktWDdvQ01BQWt3N3kuanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLVVqOUNPSUlBSUZBaDAuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNnlJeUZpQ0VBQXFsMTIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRS1UNzVsV0FBQW1xcUouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRXZaQWctVkFBQWs5MzIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRWdOTWVPWElBSWZEaEsuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRVF5SUROV2dBQXU2MEIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQ0YzVDVRVzhBRTJsR0ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWVWdzVTV29BQUFMc2ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWFKSVA3VWtBQWxJR3MuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQVFPdzlsV0VBQVk5RmwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLU9RYlZyQ01BQU53SU0uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9COWJfZXJ3Q1lBQXdSY0oucG5nOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNVBUZHZuQ2NBRUFsNHguanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNHF3QzBpQ1lBQWxQR2guanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CMmIzM3ZSSVVBQTlvMUQuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cd3BJd3IxSVVBQXZPMl8uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cc1NzZUFOQ1lBRU9oTHcuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSjR2TGZ1VXdBQWRhNEwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSTd3empFVkVBQU9QcFMuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSWRIdlQyVXNBQW5uSFYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DR0NpUF9ZV1lBQW83NVYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSVM0SlBJV0lBSTM3cXUuanBnOmxhcmdlJ1xuICAgIF07XG59KTtcbiIsImFwcC5mYWN0b3J5KCdQcm9maWxlVXBkYXRlcicsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSkge1xuXG4gIC8vd3JwcGVyIGZvciAkaHR0cCB0aGF0IGF1dG9tYXR1Y2FsbHkgYnJvYWRjYXN0cyBhbiBldmVudCAoc28gd2UgZG9uJ3QgaGF2ZSB0byBrZWVwIGNhbGxpbmcgaXQuIFNseSBhbmQgRFJZKVxuICBsZXQgaHR0cCA9IGZ1bmN0aW9uIChtZXRob2QsIHVybCwgYm9keSkge1xuXG4gICAgaWYoJHJvb3RTY29wZS5ndWVzdE1vZGUpIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhcIkd1ZXN0IG1vZGUgaXMgYWN0aXZlLiBVc2luZyBsb2NhbCBzdG9yYWdlXCIpXG4gICAgICByZXR1cm4gbG9jYWxBY3Rpb24oKG1ldGhvZCArIHVybCksIGJvZHkpO1xuICAgIH1cblxuICAgIHJldHVybiAkaHR0cFttZXRob2QudG9Mb3dlckNhc2UoKV0odXJsLCBib2R5KVxuICAgICAgLnRoZW4ocmVzID0+ICRyb290U2NvcGUuJGJyb2FkY2FzdCgndXBkYXRlLWNvbnRyb2xsZXInLCByZXMuZGF0YSkpXG4gICAgICAuY2F0Y2goZXJyID0+ICRyb290U2NvcGUuJGJyb2FkY2FzdCgndXBkYXRlLWNvbnRyb2xsZXInLCBlcnIuZGF0YSwgdHJ1ZSkpXG4gIH07XG4gIGxldCBsb2NhbEFjdGlvbiA9IGZ1bmN0aW9uIChhY3Rpb24sIHBheWxvYWQpIHtcbiAgICBjb25zb2xlLmxvZyhcImdldHRpbmcgYSBwcm9maWxlIGZyb20gbG9jYWwgc3RvcmFnZVwiKVxuICAgIGxldCBwcm9maWxlID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgncHJvZmlsZScpKTtcbiAgICBjb25zb2xlLmxvZyhcInRoZSBwcm9maWxlIHdlIGdvdFwiLCBwcm9maWxlKVxuICAgIHN3aXRjaCAoYWN0aW9uKXtcbiAgICAgIGNhc2UgJ1BVVC9hcGkvdXNlci90b21hdG9NZXRlcic6XG4gICAgICAgIHByb2ZpbGUudG9tYXRvTWV0ZXIucHVzaChwYXlsb2FkLnRvbWF0byk7XG4gICAgICAgIGlmKHBheWxvYWQudG9tYXRvLmNsYXNzID09PSAnY29tcGxldGUnKSBwcm9maWxlLnRvbXNUb2RheSsrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1BPU1QvYXBpL3VzZXIvdG9tYXRvTWV0ZXIvYXJjaGl2ZSc6XG4gICAgICAgIHByb2ZpbGUuYXJjaGl2ZS5wdXNoKHtcbiAgICAgICAgICBkYXRlOiBTZC5jb252ZXJ0U2QocHJvZmlsZS5zdW5EaWFsKSxcbiAgICAgICAgICB0b21hdG9NZXRlcjogcHJvZmlsZS50b21hdG9NZXRlclxuICAgICAgICB9KTtcbiAgICAgICAgcHJvZmlsZS50b21hdG9NZXRlciA9IFtdO1xuICAgICAgICBwcm9maWxlLnRvbXNUb2RheSA9IDA7XG4gICAgICAgIHByb2ZpbGUuc3VuRGlhbCA9IFNkKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhcInRoZSBuZXcgcHJvZmlsZVwiLCBwcm9maWxlKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncHJvZmlsZScsIEpTT04uc3RyaW5naWZ5KHByb2ZpbGUpKTtcbiAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ3VwZGF0ZS1jb250cm9sbGVyJywgcHJvZmlsZSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHB1c2hUb21hdG9NZXRlcjogZnVuY3Rpb24gKHRvbWF0bykge1xuICAgICAgLy8gc3R1ZmYgZ29lcyBoZXJlXG4gICAgICBjb25zb2xlLmxvZyhcIndoYXQgaXMgdGhlIHNlc3Npb24gYW55d2hvID8/XCIsIFNlc3Npb24pO1xuICAgICAgcmV0dXJuIGh0dHAoJ1BVVCcsICcvYXBpL3VzZXIvdG9tYXRvTWV0ZXInLCB7XG4gICAgICAgIHVzZXI6IFNlc3Npb24udXNlciAmJiBTZXNzaW9uLnVzZXIuX2lkLCAvL1RPRE86IHJlbW92ZSBhbmQgdXNlIHRoZSB1c2VyIG9uIHRoZSByZXEuYm9keSBmcm9tIGJhY2tlbmRcbiAgICAgICAgdG9tYXRvLFxuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWxldGVUb21hdG9NZXRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgLy8gZGVsZXRlcyB0aGUgY3VycmVudCB0b21hdG8gbWV0ZXIgb2YgdGhlIGRheS5cbiAgICAgIHJldHVybiBodHRwKCdERUxFVEUnLCAnL2FwaS91c2VyL3RvbWF0b01ldGVyP3VzZXI9JyArIFNlc3Npb24udXNlci5faWQpO1xuICAgICAgcmV0dXJuICRodHRwLmRlbGV0ZSgnL2FwaS91c2VyL3RvbWF0b01ldGVyP3VzZXI9JyArIFNlc3Npb24udXNlci5faWQpO1xuICAgIH0sXG4gICAgYXJjaGl2ZVRvbWF0b01ldGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gaHR0cCgnUE9TVCcsICcvYXBpL3VzZXIvdG9tYXRvTWV0ZXIvYXJjaGl2ZScpO1xuICAgIH0sXG4gIH1cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1JhbmRvbUdyZWV0aW5ncycsIGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBnZXRSYW5kb21Gcm9tQXJyYXkgPSBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIHJldHVybiBhcnJbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYXJyLmxlbmd0aCldO1xuICAgIH07XG5cbiAgICB2YXIgZ3JlZXRpbmdzID0gW1xuICAgICAgICAnSGVsbG8sIHdvcmxkIScsXG4gICAgICAgICdBdCBsb25nIGxhc3QsIEkgbGl2ZSEnLFxuICAgICAgICAnSGVsbG8sIHNpbXBsZSBodW1hbi4nLFxuICAgICAgICAnV2hhdCBhIGJlYXV0aWZ1bCBkYXkhJyxcbiAgICAgICAgJ0lcXCdtIGxpa2UgYW55IG90aGVyIHByb2plY3QsIGV4Y2VwdCB0aGF0IEkgYW0geW91cnMuIDopJyxcbiAgICAgICAgJ1RoaXMgZW1wdHkgc3RyaW5nIGlzIGZvciBMaW5kc2F5IExldmluZS4nLFxuICAgICAgICAn44GT44KT44Gr44Gh44Gv44CB44Om44O844K244O85qeY44CCJyxcbiAgICAgICAgJ1dlbGNvbWUuIFRvLiBXRUJTSVRFLicsXG4gICAgICAgICc6RCcsXG4gICAgICAgICdZZXMsIEkgdGhpbmsgd2VcXCd2ZSBtZXQgYmVmb3JlLicsXG4gICAgICAgICdHaW1tZSAzIG1pbnMuLi4gSSBqdXN0IGdyYWJiZWQgdGhpcyByZWFsbHkgZG9wZSBmcml0dGF0YScsXG4gICAgICAgICdJZiBDb29wZXIgY291bGQgb2ZmZXIgb25seSBvbmUgcGllY2Ugb2YgYWR2aWNlLCBpdCB3b3VsZCBiZSB0byBuZXZTUVVJUlJFTCEnLFxuICAgIF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBncmVldGluZ3M6IGdyZWV0aW5ncyxcbiAgICAgICAgZ2V0UmFuZG9tR3JlZXRpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRSYW5kb21Gcm9tQXJyYXkoZ3JlZXRpbmdzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1N0b3JlJywgZnVuY3Rpb24gKCRsb2cpIHtcblxuICAgIC8vVE9ETzogb25jZSB1c2VycyBpcyBpbXBsaW1lbnRlZCwgdGhlIGJlbG93IGRlZmF1bHRTdG9yZSB3aWxsIG9ubHkgYmUgcmV0dXJlZCBpZiB1c2VyIGlzIG5vdCBsb2dnZWQgaW5cbiAgICAvLyB0aGlzIGlzIHRoZSBzdGFydG5nIHVzZXIgc3RhdGUgYW5kIHdpbGwgYmUgbW9kaWZlZCBmb3IgYXMgbG9uZyBhcyBzZXNzaW9uIGlzIGFjdGl2ZS4gV2hlbiBhIHVzZXIgc2lnbnMgdXAsXG4gICAgLy8gYW55IHByb2dyZXNzIGZyb20gaGVyZSB3aWxsIGJlIHBhc3NlZCB0byB0aGUgdXNlciBjcmVhdGlvbi5cblxuICAgIGxldCBTdG9yZSA9IHtcbiAgICAgICAgLy9UT0RPIG5lZWQgdG8gZmluZCBhIGJldHRlciB3YXkgdG8gdXBkYXRlIHRoZSBzdG9yZVxuICAgICAgICBuZXdSZXM6IG51bGwsXG4gICAgICAgIHVzZXI6IG51bGwsXG4gICAgICAgIHByb2ZpbGU6IHtcbiAgICAgICAgICAgIGFyY2hpdmU6IFtdLFxuICAgICAgICAgICAgdG9tc0VhdGVuOiB7XG4gICAgICAgICAgICAgICAgdG9kYXk6IDAsXG4gICAgICAgICAgICAgICAgdG9tYXRvTWV0ZXI6IFtdLFxuICAgICAgICAgICAgICAgIGFyY2hpdmU6IFtcbiAgICAgICAgICAgICAgICAgICAgLy9UT0RPOiBSRU1PVkUgb24gOC8yNVxuICAgICAgICAgICAgICAgICAgICAvL3tkYXRlOiBEYXRlLCB0b3RhbDogMCwgdG9tYXRvTWV0ZXI6IHs8dG9tYXRvTWV0ZXI+fSB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBnZXRUb3RhbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RvcmUucHJvZmlsZS50b21zRWF0ZW4uYXJjaGl2ZS5tYXAodCA9PiB0LnRvdGFsKS5yZWR1Y2UoKHAsIG4pID0+IHAgKyBuLCBTdG9yZS5wcm9maWxlLnRvbXNUb2RheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB1bmxvY2tlZEZlYXR1cmVzOiBbXSxcbiAgICAgICAgZmVhdHVyZXM6IFtcbiAgICAgICAgICAgIHtuYW1lOiBcImdvYWxTZXR0ZXJcIiwgdW5sb2NrQXQ6IDEsIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJ9LFxuICAgICAgICAgICAge25hbWU6IFwidG9kb1wiLCB1bmxvY2tBdDogMywgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJtYXJrRmFpbFwiLCB1bmxvY2tBdDoge2RheXNDb21wbGV0ZTogMn0sIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJ9LFxuICAgICAgICAgICAge25hbWU6IFwic25ha2VcIiwgdW5sb2NrQXQ6IDgsIHR5cGU6IFwiZ2FtZVwiLCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcInBsYXlsaXN0XCIsIHVubG9ja0F0OiB7dG9tc1RvZGF5OiA4fSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJnb2FsU2V0dG9yXCIsIHVubG9ja0F0OiB7c3RyZWFrOiAzfSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJ0ZXRyaXNcIiwgdW5sb2NrQXQ6IDQ0LCB0eXBlOiBcImdhbWVcIiwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJkYXJrVGhlbWVcIixcbiAgICAgICAgICAgICAgICB1bmxvY2tBdDoge2RheXNDb21wbGV0ZTogMzB9LFxuICAgICAgICAgICAgICAgIHVubG9ja0ZuOiAoKSA9PiAobmV3IERhdGUoKSkuZ2V0SG91cnMoKSA+IDE4LFxuICAgICAgICAgICAgICAgIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7bmFtZTogXCIxMDAwdG9tc1BhZ2VcIiwgdW5sb2NrQXQ6IDEwMDAsIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJ9LFxuICAgICAgICBdLFxuICAgICAgICBnZXRUb3RhbFRvbXM6ICh1c2VyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gXy5zdW0odXNlci5hcmNoaXZlLm1hcChpID0+IGkudG9tYXRvTWV0ZXIuZmlsdGVyKHQgPT4gdC5jbGFzcyA9PT0gJ2NvbXBsZXRlJykubGVuZ3RoKSkgKyAodXNlci50b21zVG9kYXkgfHwgMCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1ldGVyPz8/IFwiLCBhcmNoaXZlVG90YWxzKVxuICAgICAgICAgICAgcmV0dXJuIHVzZXIuYXJjaGl2ZS5yZWR1Y2UoKHAsIHRvbWF0b1NlcmllcykgPT4gdG9tYXRvU2VyaWVzLnRvbWF0b01vdGVyLnJlZHVjZSgocCwgdCkgPT4gKHQuY2xhc3MgPT09ICdjb21wbGV0ZScgPyAxOjApICsgcCwwKVxuICAgICAgICAgICAgICAgICsgcCwwKVxuICAgICAgICAgICAgICAgICsgdXNlci50b21zVG9kYXkgfHwgMDtcbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAobmV3UHJvcHMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIC8vIG1vdmUgdGhpcyBzb21ld2hlcmUgZWxzZVxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKVxuICAgICAgICAgICAgICAgIC50aGVuKHJlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvdXNlci8nLCB7bmV3UHJvcHM6IG5ld1Byb3BzLCB1c2VyOiByZXMuZGF0YS51c2VyfSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKHVzZXIgPT4gY29uc29sZS5sb2coXCJuZXcgdXNlciBkYXRhXCIsIHVzZXIpKVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmVycm9yKFwic29tZXRoaW5nIHdlbnQgd3JvbmdcIiwgZXJyb3IpKTtcbiAgICAgICAgfSxcbiAgICAgICAgYXJjaGl2ZVRvbXNFYXRlbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCFTdG9yZS5wcm9maWxlLnRvbXNUb2RheSkge1xuICAgICAgICAgICAgICAgICRsb2cuaW5mbyhcIm5vdGhpbmcgdG8gYXJjaGl2ZS4gVXNlciBub3QgdXBkYXRlZFwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdG9tSW5mbyA9IHtcbiAgICAgICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIHRvdGFsOiBTdG9yZS5wcm9maWxlLnRvbXNUb2RheSxcbiAgICAgICAgICAgICAgICB0b21hdG9NZXRlcjogU3RvcmUucHJvZmlsZS50b21zRWF0ZW4udG9tYXRvTWV0ZXIuZmlsdGVyKHQgPT4gdC50ZXh0ICE9PSBcIi4uLlwiKSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi50b21hdG9NZXRlciA9IFtdO1xuICAgICAgICAgICAgbGV0IG5ld0FyY2hpdmUgPSBbdG9tSW5mb10uY29uY2F0KFN0b3JlLnByb2ZpbGUudG9tc0VhdGVuLmFyY2hpdmUpO1xuICAgICAgICAgICAgcmV0dXJuIFN0b3JlLnVwZGF0ZVByb2ZpbGUoe3RvbXNFYXRlbjoge2FyY2hpdmU6IG5ld0FyY2hpdmV9fSk7XG4gICAgICAgIH0sXG4gICAgfTtcblxuICAgIC8vIGF0dGFjaCB1c2VyIHRvIHRoZSBzdG9yZVxuXG4gICAgcmV0dXJuIFN0b3JlO1xuXG59KTtcblxuLypcbiB1bmxvY2tBdDpcbiBOdW1iZXIgLSBhbW91bnQgb2YgdG90YWwgdG9tcyBlYXRlblxuIE9iaiAtIGRpZmZlcmVudCBwcm9wIHRvIHVubG9jayBhdDpcbiB0b21zQ29tcGxldGUgKGRlZnVhbHQpIC0gdG90YWwgdG9tcyBlYXRlbi4gU2FtZSBhcyBwYXNzaW5nIG51bWJlclxuIHRvbXNUb2RheSAtIG51bWJlciBpbiBhIGRheS5cbiBkYXlzQ29tcGxldGU6IG51bWJlciBvZiBkYXlzIGEgdG9tIHdhcyBlYXRlbjogT1Igb2JqXG4gc3RyZWFrOiBudW1iZXIgZGF5cyBpbiBhIHJvdyB0aGF0IGEgdG9tIHdhcyBlYXRlbi5cblxuIEZlYXR1cmUgbGlzdGVuZXJzOlxuIFwidG9tQ29tcGxldGVcIiA6IHdoZW4gYSBwb21vZG9ybyBpcyBzdWNlc3NmdWxseSBjb21wbGV0ZS5cbiBcIm5ld0RheVwiIDogd2hlbiB0aGUgYXBwIGlzIG9wZW5lZCBvbiBhIG5ldyBkYXkuXG4gKi9cbiIsImFwcC5kaXJlY3RpdmUoJ2Z1bGxzdGFja0xvZ28nLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9mdWxsc3RhY2stbG9nby9mdWxsc3RhY2stbG9nby5odG1sJ1xuICAgIH07XG59KTsiLCJhcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsIEFVVEhfRVZFTlRTLCAkc3RhdGUsICR3aW5kb3cpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHNjb3BlOiB7fSxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmh0bWwnLFxuICAgICAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUpIHtcblxuICAgICAgICAgICAgc2NvcGUuaXRlbXMgPSBbXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ1BvbW9kb3JvJywgc3RhdGU6ICdob21lJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdNeSBTdHVmZicsIHN0YXRlOiAnbWUnLCBhdXRoOiB0cnVlfSxcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnTGVhcm4nLCBzdGF0ZTogJ2xlYXJuJ30sXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ0Fib3V0IC8gU3VwcG9ydCcsIHN0YXRlOiAnYWJvdXQnIH0sXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgc2NvcGUuc3RhdGUgPSAkc3RhdGU7XG5cbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuXG4gICAgICAgICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgcmVtb3ZlVXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzZXRVc2VyKCk7XG5cbiAgICAgICAgICAgIHNjb3BlLmdvQmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkd2luZG93Lmhpc3RvcnkuYmFjaygpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG4gICAgICAgICAgICB2YXIgJGRyb3Bkb3duID0gJChcIi5uYXZiYXItbmF2LW1vYmlsZS1kcm9wZG93blwiKTtcblxuICAgICAgICAgICAgc2NvcGUudG9nZ2xlTW9iaWxlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYoJHN0YXRlLmN1cnJlbnQubmFtZSA9PT0gJ2xvZ2luJykgcmV0dXJuO1xuICAgICAgICAgICAgICAgICRkcm9wZG93bi50b2dnbGVDbGFzcygnb3BlbmVkJyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIGNsb3NlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgJGRyb3Bkb3duLnJlbW92ZUNsYXNzKCdvcGVuZWQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBjbG9zZURyb3Bkb3duKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICQoJyNtYWluJykub24oJ2NsaWNrJywgY2xvc2VEcm9wZG93bik7XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgIH1cblxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmRpcmVjdGl2ZSgncmFuZG9HcmVldGluZycsIGZ1bmN0aW9uIChSYW5kb21HcmVldGluZ3MpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvcmFuZG8tZ3JlZXRpbmcvcmFuZG8tZ3JlZXRpbmcuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgICAgICAgc2NvcGUuZ3JlZXRpbmcgPSBSYW5kb21HcmVldGluZ3MuZ2V0UmFuZG9tR3JlZXRpbmcoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pOyIsImFwcC5kaXJlY3RpdmUoJ3NwbGFzaFNjcmVlbicsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZTogJzxkaXYgaWQ9XCJzcGxhc2gtc2NyZWVuXCI+PGRpdiBpZD1cImxvYWRpbmctY29udGVudFwiPnt7bG9hZGluZ1RleHR9fTwvZGl2PjwvZGl2PicsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlKSB7XG5cbiAgICAgICAgICAgIHNjb3BlLmxvYWRpbmdUZXh0ID0gXCJMb2FkaW5nXCI7XG4gICAgICAgICAgICB2YXIgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGFwcGVuZCA9IHNjb3BlLmxvYWRpbmdUZXh0ICsgXCIgLlwiO1xuICAgICAgICAgICAgICAgIGlmKGFwcGVuZC5sZW5ndGggPiAxNCkgYXBwZW5kID0gXCJMb2FkaW5nXCI7XG4gICAgICAgICAgICAgICAgc2NvcGUubG9hZGluZ1RleHQgPSBhcHBlbmQ7XG4gICAgICAgICAgICAgICAgc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICAgICAgfSwgNDAwKTtcblxuICAgICAgICAgICAgdmFyIHNwbGFzaFRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmKCF3aW5kb3cucmVhZHkpIHJldHVybjtcbiAgICAgICAgICAgICAgICAvLyBkZWxldGUgd2luZG93LnJlYWR5O1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoc3BsYXNoVGltZXIpO1xuICAgICAgICAgICAgICAgIGVsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgIH0sMjAwMCArIChNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiA1MDApKSk7XG5cbiAgICAgICAgfVxuICAgIH1cbn0pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
