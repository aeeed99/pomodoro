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
        $scope.time = ":(";
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
        $scope.time = "0:00";
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
    $stateProvider.state('docs', {
        url: '/docs',
        templateUrl: 'js/docs/docs.html'
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
            alert("hit the tomato meter");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLmpzIiwibGVhcm4vbGVhcm4uanMiLCJsb2dpbi9sb2dpbi5qcyIsIm15LXN0dWZmL215LXN0dWZmLmpzIiwiZG9jcy9kb2NzLmpzIiwiYWJvdXQvYWJvdXQuanMiLCJjb21tb24vZmFjdG9yaWVzL0Z1bGxzdGFja1BpY3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1Byb2ZpbGVVcGRhdGVyLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1N0b3JlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZnVsbHN0YWNrLWxvZ28vZnVsbHN0YWNrLWxvZ28uanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvcmFuZG8tZ3JlZXRpbmcvcmFuZG8tZ3JlZXRpbmcuanMiLCJjb21tb24vZGlyZWN0aXZlcy9zcGxhc2gtc2NyZWVuL3NwbGFzaC1zY3JlZW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUEsYUFBQSxpQkFBQTs7QUFFQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsSUFBQSxNQUFBLENBQUEsVUFBQSxrQkFBQSxFQUFBLGlCQUFBLEVBQUE7QUFDQTtBQUNBLHNCQUFBLFNBQUEsQ0FBQSxJQUFBO0FBQ0E7QUFDQSx1QkFBQSxTQUFBLENBQUEsR0FBQTtBQUNBO0FBQ0EsdUJBQUEsSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBLGVBQUEsUUFBQSxDQUFBLE1BQUE7QUFDQSxLQUZBO0FBR0EsQ0FUQTs7QUFXQTtBQUNBLElBQUEsR0FBQSxDQUFBLFVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQSxFQUFBOztBQUVBLFVBQUEsR0FBQSxDQUFBLGlCQUFBLEVBQUEsSUFBQSxDQUFBLGVBQUE7QUFDQSxlQUFBLFVBQUEsR0FBQSxJQUFBLE1BQUEsS0FBQSxHQUFBO0FBQ0EsZUFBQSxLQUFBLEdBQUEsSUFBQTtBQUNBLFlBQUEsT0FBQSxVQUFBLEVBQUE7QUFDQSxnQkFBQSxRQUFBLFNBQUEsS0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLEdBQUEsR0FBQSxLQUFBO0FBQ0Esb0JBQUEsSUFBQSxHQUFBLEtBQUE7QUFDQSxvQkFBQSxJQUFBLEdBQUEsS0FBQTtBQUNBLG9CQUFBLEtBQUEsR0FBQSxLQUFBO0FBQ0E7QUFDQSxLQVZBOztBQVlBO0FBQ0EsUUFBQSwrQkFBQSxTQUFBLDRCQUFBLENBQUEsS0FBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLElBQUEsSUFBQSxNQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0EsS0FGQTs7QUFJQTtBQUNBO0FBQ0EsZUFBQSxHQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsUUFBQSxFQUFBOztBQUVBLFlBQUEsQ0FBQSw2QkFBQSxPQUFBLENBQUEsRUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFlBQUEsWUFBQSxlQUFBLEVBQUEsRUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsY0FBQSxjQUFBOztBQUVBLG9CQUFBLGVBQUEsR0FBQSxJQUFBLENBQUEsVUFBQSxJQUFBLEVBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQSxFQUFBLENBQUEsUUFBQSxJQUFBLEVBQUEsUUFBQTtBQUNBLGFBRkEsTUFFQTtBQUNBLHVCQUFBLEVBQUEsQ0FBQSxPQUFBO0FBQ0E7QUFDQSxTQVRBO0FBV0EsS0E1QkE7QUE4QkEsQ0FuREE7O0FDbEJBLENBQUEsWUFBQTs7QUFFQTs7QUFFQTs7QUFDQSxRQUFBLENBQUEsT0FBQSxPQUFBLEVBQUEsTUFBQSxJQUFBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBOztBQUVBLFFBQUEsTUFBQSxRQUFBLE1BQUEsQ0FBQSxhQUFBLEVBQUEsRUFBQSxDQUFBOztBQUVBLFFBQUEsT0FBQSxDQUFBLFFBQUEsRUFBQSxZQUFBO0FBQ0EsWUFBQSxDQUFBLE9BQUEsRUFBQSxFQUFBLE1BQUEsSUFBQSxLQUFBLENBQUEsc0JBQUEsQ0FBQTtBQUNBLGVBQUEsT0FBQSxFQUFBLENBQUEsT0FBQSxRQUFBLENBQUEsTUFBQSxDQUFBO0FBQ0EsS0FIQTs7QUFLQTtBQUNBO0FBQ0E7QUFDQSxRQUFBLFFBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQSxzQkFBQSxvQkFEQTtBQUVBLHFCQUFBLG1CQUZBO0FBR0EsdUJBQUEscUJBSEE7QUFJQSx3QkFBQSxzQkFKQTtBQUtBLDBCQUFBLHdCQUxBO0FBTUEsdUJBQUE7QUFOQSxLQUFBOztBQVNBLFFBQUEsT0FBQSxDQUFBLGlCQUFBLEVBQUEsVUFBQSxVQUFBLEVBQUEsRUFBQSxFQUFBLFdBQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLGFBQUE7QUFDQSxpQkFBQSxZQUFBLGdCQURBO0FBRUEsaUJBQUEsWUFBQSxhQUZBO0FBR0EsaUJBQUEsWUFBQSxjQUhBO0FBSUEsaUJBQUEsWUFBQTtBQUpBLFNBQUE7QUFNQSxlQUFBO0FBQ0EsMkJBQUEsdUJBQUEsUUFBQSxFQUFBO0FBQ0EsMkJBQUEsVUFBQSxDQUFBLFdBQUEsU0FBQSxNQUFBLENBQUEsRUFBQSxRQUFBO0FBQ0EsdUJBQUEsR0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBO0FBQ0E7QUFKQSxTQUFBO0FBTUEsS0FiQTs7QUFlQSxRQUFBLE1BQUEsQ0FBQSxVQUFBLGFBQUEsRUFBQTtBQUNBLHNCQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsQ0FDQSxXQURBLEVBRUEsVUFBQSxTQUFBLEVBQUE7QUFDQSxtQkFBQSxVQUFBLEdBQUEsQ0FBQSxpQkFBQSxDQUFBO0FBQ0EsU0FKQSxDQUFBO0FBTUEsS0FQQTs7QUFTQSxRQUFBLE9BQUEsQ0FBQSxhQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUEsT0FBQSxFQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBLEtBQUEsRUFBQTs7QUFFQSxpQkFBQSxpQkFBQSxDQUFBLFFBQUEsRUFBQTs7QUFFQSxvQkFBQSxHQUFBLENBQUEsd0JBQUEsRUFBQSxRQUFBO0FBQ0Esa0JBQUEsTUFBQSxHQUFBLFFBQUE7QUFDQSxpQ0FBQSxRQUFBOztBQUVBLGdCQUFBLE9BQUEsTUFBQSxNQUFBLENBQUEsSUFBQTtBQUNBLG9CQUFBLEdBQUEsQ0FBQSxjQUFBLEVBQUEsSUFBQTtBQUNBLG9CQUFBLE1BQUEsQ0FBQSxLQUFBLEVBQUEsRUFBQSxLQUFBLElBQUE7QUFDQTtBQUNBO0FBQ0Esa0JBQUEsT0FBQSxHQUFBLEtBQUEsSUFBQTtBQUNBLGtCQUFBLElBQUEsR0FBQSxLQUFBLElBQUEsSUFBQSxLQUFBLElBQUEsQ0FBQSxFQUFBO0FBQ0EsdUJBQUEsU0FBQSxHQUFBLEtBQUE7QUFDQSx1QkFBQSxVQUFBLENBQUEsWUFBQSxZQUFBO0FBQ0EsbUJBQUEsS0FBQSxJQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGFBQUEsZUFBQSxHQUFBLFlBQUE7QUFDQSxtQkFBQSxDQUFBLENBQUEsUUFBQSxJQUFBO0FBQ0EsU0FGQTtBQUdBLGlCQUFBLG9CQUFBLENBQUEsY0FBQSxFQUFBO0FBQ0EsZ0JBQUEsZUFBQSxhQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUE7QUFDQSxnQkFBQSxZQUFBLEVBQUE7QUFDQSwrQkFBQSxLQUFBLEtBQUEsQ0FBQSxZQUFBLENBQUE7QUFDQTtBQUNBLHVCQUFBLE1BQUEsR0FBQSxDQUFBLHdCQUFBLEVBQUEsRUFBQSwwQkFBQSxFQUFBLEVBQ0EsSUFEQSxDQUNBLHVCQUFBO0FBQ0EsNEJBQUEsR0FBQSxDQUFBLHNCQUFBLEVBQUEsV0FBQTtBQUNBLCtCQUFBLFVBQUEsQ0FBQSxtQkFBQSxFQUFBLFlBQUEsSUFBQTtBQUNBLGlDQUFBLFVBQUEsQ0FBQSxTQUFBO0FBQ0EsMEJBQUEsTUFBQSxHQUFBLFdBQUE7QUFDQSwyQkFBQSxXQUFBO0FBQ0EsaUJBUEEsQ0FBQTtBQVFBLGFBWEEsTUFXQSxPQUFBLE1BQUEsTUFBQSxHQUFBLGNBQUE7QUFDQTs7QUFFQSxhQUFBLGVBQUEsR0FBQSxVQUFBLFVBQUEsRUFBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsZ0JBQUEsS0FBQSxlQUFBLE1BQUEsZUFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQSxHQUFBLElBQUEsQ0FBQSxRQUFBLElBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1CQUFBLE1BQUEsR0FBQSxDQUFBLFVBQUEsRUFBQSxFQUFBLFdBQUEsSUFBQSxJQUFBLEVBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQSxpQkFBQSxFQUFBLEtBQUEsQ0FBQSxZQUFBO0FBQ0EsdUJBQUEsSUFBQTtBQUNBLGFBRkEsQ0FBQTtBQUlBLFNBcEJBOztBQXNCQSxhQUFBLEtBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtBQUNBLG1CQUFBLE1BQUEsSUFBQSxDQUFBLFFBQUEsRUFBQSxXQUFBLEVBQ0EsSUFEQSxDQUNBLGlCQURBLEVBRUEsS0FGQSxDQUVBLFlBQUE7QUFDQSx1QkFBQSxHQUFBLE1BQUEsQ0FBQSxFQUFBLFNBQUEsNEJBQUEsRUFBQSxDQUFBO0FBQ0EsYUFKQSxDQUFBO0FBS0EsU0FOQTs7QUFRQSxhQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUEsTUFBQSxHQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0Esd0JBQUEsT0FBQTtBQUNBLDJCQUFBLFVBQUEsQ0FBQSxZQUFBLGFBQUE7QUFDQSxhQUhBLENBQUE7QUFJQSxTQUxBO0FBT0EsS0E5RUE7O0FBZ0ZBLFFBQUEsT0FBQSxDQUFBLFNBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUE7O0FBRUEsWUFBQSxPQUFBLElBQUE7O0FBRUEsbUJBQUEsR0FBQSxDQUFBLFlBQUEsZ0JBQUEsRUFBQSxZQUFBO0FBQ0EsaUJBQUEsT0FBQTtBQUNBLFNBRkE7O0FBSUEsbUJBQUEsR0FBQSxDQUFB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QUFBLEdBQUEsQ0FBQTtBQUNBLG9CQUFBLEtBQUEsU0FBQSxJQUFBLENBQUE7QUFDQTtBQUNBO0FBQ0EsS0FaQTs7QUFjQTtBQUNBLFdBQUEsT0FBQSxHQUFBLEtBQUEsT0FBQTtBQUNBLFdBQUEsV0FBQSxHQUFBLEtBQUEsV0FBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLE9BQUEsTUFBQSxFQUFBLE1BQUEsS0FBQSxFQUFBLENBQUE7QUFDQSxRQUFBLFlBQUEsS0FBQSxTQUFBLElBQUEsQ0FBQTs7QUFFQTtBQUNBLFdBQUEsS0FBQSxHQUFBO0FBQ0EsZUFBQSxLQURBO0FBRUEsc0JBQUEsS0FGQTtBQUdBLHFCQUFBLEtBSEE7QUFJQSxpQkFBQSxLQUpBO0FBS0EsaUJBQUEsS0FMQTtBQU1BLGlCQUFBLEVBTkE7QUFPQSxzQkFBQSxJQVBBO0FBUUEsb0JBQUE7QUFSQSxLQUFBO0FBVUEsUUFBQSxRQUFBLE9BQUEsS0FBQSxDQTdDQSxDQTZDQTtBQUNBLFFBQUEsUUFBQSxFQUFBLFlBQUE7QUFBQSxtQkFBQSxJQUFBO0FBQUEsU0FBQSxFQUFBLENBOUNBLENBOENBO0FBQ0EsUUFBQSxtQkFBQTs7QUFFQSxRQUFBLFVBQUEsU0FBQSxPQUFBO0FBQUEsZUFBQSxPQUFBLElBQUEsSUFBQSxpQkFBQTtBQUFBLEtBQUE7O0FBRUEsV0FBQSxZQUFBLEdBQUE7QUFBQSxlQUFBLFNBQUE7QUFBQSxLQUFBO0FBQ0EsV0FBQSxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUEsTUFBQSxZQUFBLENBQUEsSUFBQSxDQUFBO0FBQ0EsS0FGQTs7QUFJQTs7O0FBR0EsV0FBQSxJQUFBLEdBQUEsTUFBQTtBQUNBO0FBQ0EsUUFBQSxZQUFBLE9BQUEsV0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLElBQUEsQ0FBQTs7QUFFQSxXQUFBLFlBQUEsR0FBQSxVQUFBLGFBQUEsRUFBQTtBQUNBLHlCQUFBLE1BQUEsVUFBQSxFQUFBO0FBRUEsS0FIQTs7QUFLQSxXQUFBLFVBQUEsR0FBQSxZQUFBO0FBQUEsWUFBQSxJQUFBLHlEQUFBLENBQUEsRUFBQSxFQUFBLENBQUEsQ0FBQTtBQUFBLFlBQUEsVUFBQTtBQUFBLFlBQUEsVUFBQTs7QUFDQSxxQkFBQSxjQUFBLFlBQUE7QUFDQTtBQUNBLGdCQUFBLE1BQUEsS0FBQSxLQUFBLFVBQUEsRUFBQSxTQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsZ0JBQUEsTUFBQSxLQUFBLEtBQUEsT0FBQSxJQUFBLE1BQUEsS0FBQSxLQUFBLFlBQUEsRUFBQSxTQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLFdBQUE7QUFDQSxtQkFBQSxPQUFBO0FBQ0EsU0FMQTtBQU1BLGdCQUFBLEdBQUEsQ0FBQSxjQUFBLEVBQUEsVUFBQTtBQUNBLGNBQUEsVUFBQTtBQUNBLGdCQUFBLElBQUEsS0FBQSxDQUFBLElBQUEsRUFBQSxVQUFBLEVBQUEsVUFBQSxDQUFBO0FBQ0EsWUFBQSxNQUFBLEtBQUEsS0FBQSxVQUFBLEVBQUEsU0FBQSxLQUFBLEdBQUEsT0FBQSxPQUFBLElBQUEsR0FBQSxPQUFBLElBQUEsTUFBQSxHQUFBLFNBQUE7QUFDQSxLQVhBOztBQWFBLFdBQUEsYUFBQSxHQUFBLFlBQUE7QUFDQSxjQUFBLEtBQUEsR0FBQSxNQUFBO0FBQ0EsbUJBQUE7QUFBQSxtQkFBQSxNQUFBLEtBQUEsR0FBQSxVQUFBO0FBQUEsU0FBQSxFQUFBLElBQUE7QUFDQSxjQUFBLFlBQUEsR0FBQSxJQUFBOztBQUVBLFlBQUEsWUFBQSxPQUFBLFdBQUEsQ0FBQSxTQUFBLENBQUE7QUFDQSxrQkFBQSxLQUFBLEdBQUEsUUFBQTtBQUNBLGtCQUFBLElBQUEsR0FBQSxZQUFBLENBQUE7O0FBRUEsWUFBQSxhQUFBLFNBQUEsVUFBQSxHQUFBO0FBQ0EsZ0JBQUEsU0FBQSxNQUFBLEVBQUEsSUFBQSxZQUFBLENBQUEsbUJBQUEsRUFBQTtBQUNBLHNCQUFBLCtDQURBO0FBRUEsc0JBQUE7QUFGQSxhQUFBO0FBSUEsbUJBQUEsYUFBQTtBQUNBLG1CQUFBLE9BQUE7QUFDQSxtQkFBQSxPQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLFNBUkE7QUFTQSxZQUFBLGFBQUEsU0FBQSxVQUFBLEdBQUE7QUFDQTtBQUNBLHFCQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsbUJBQUEsT0FBQTtBQUNBLFNBSkE7QUFLQSxjQUFBLE9BQUEsR0FBQSxhQUFBO0FBQ0EsaUJBQUEsS0FBQSxHQUFBLE9BQUEsT0FBQSxJQUFBLEdBQUEsT0FBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsZUFBQSxVQUFBLENBQUEsQ0FBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUEsVUFBQSxFQUFBLFVBQUE7QUFDQSxLQTFCQTs7QUE0QkEsV0FBQSxVQUFBLEdBQUEsWUFBQTtBQUFBLFlBQUEsSUFBQSx5REFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUE7O0FBQ0EsY0FBQSxLQUFBLEdBQUEsTUFBQTtBQUNBLG1CQUFBO0FBQUEsbUJBQUEsTUFBQSxLQUFBLEdBQUEsT0FBQTtBQUFBLFNBQUEsRUFBQSxJQUFBO0FBQ0EsY0FBQSxhQUFBLEdBQUEsS0FBQTtBQUNBLGNBQUEsT0FBQSxHQUFBLElBQUE7QUFDQSxjQUFBLE9BQUEsR0FBQSx3R0FBQTtBQUNBLFlBQUEsYUFBQSxTQUFBLFVBQUEsR0FBQTtBQUNBLGdCQUFBLFNBQUEsTUFBQSxFQUFBLElBQUEsWUFBQSxDQUFBLGFBQUEsRUFBQTtBQUNBLHNCQUFBLCtDQURBO0FBRUEsc0JBQUE7QUFGQSxhQUFBO0FBSUEsbUJBQUEsU0FBQTtBQUNBLFNBTkE7QUFPQSxlQUFBLFVBQUEsQ0FBQSxJQUFBLEVBQUEsVUFBQTtBQUNBLEtB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QUFBLEdBREE7QUFFQSxxQkFBQSx5REFGQTtBQUdBLGNBQUEsY0FBQSxLQUFBLEVBQUE7QUFDQSxrQkFBQSxRQUFBLEdBQUEsZ0JBQUEsaUJBQUEsRUFBQTtBQUNBO0FBTEEsS0FBQTtBQVFBLENBVkE7QUNBQSxJQUFBLFNBQUEsQ0FBQSxjQUFBLEVBQUEsWUFBQTtBQUNBLFdBQUE7QUFDQSxrQkFBQSxHQURBO0FBRUEsa0JBQUEsK0VBRkE7QUFHQSxjQUFBLGNBQUEsS0FBQSxFQUFBLEdBQUEsRUFBQTs7QUFFQSxrQkFBQSxXQUFBLEdBQUEsU0FBQTtBQUNBLGdCQUFBLFdBQUEsWUFBQSxZQUFBO0FBQ0Esb0JBQUEsU0FBQSxNQUFBLFdBQUEsR0FBQSxJQUFBO0FBQ0Esb0JBQUEsT0FBQSxNQUFBLEdBQUEsRUFBQSxFQUFBLFNBQUEsU0FBQTtBQUNBLHNCQUFBLFdBQUEsR0FBQSxNQUFBO0FBQ0Esc0JBQUEsT0FBQTtBQUNBLGFBTEEsRUFLQSxHQUxBLENBQUE7O0FBT0EsZ0JBQUEsY0FBQSxZQUFBLFlBQUE7QUFDQSxvQkFBQSxDQUFBLE9BQUEsS0FBQSxFQUFBO0FBQ0E7QUFDQSw4QkFBQSxRQUFBO0FBQ0EsOEJBQUEsV0FBQTtBQUNBLG9CQUFBLE1BQUE7QUFDQSxhQU5BLEVBTUEsT0FBQSxLQUFBLEtBQUEsQ0FBQSxLQUFBLE1BQUEsS0FBQSxHQUFBLENBTkEsQ0FBQTtBQVFBO0FBckJBLEtBQUE7QUF1QkEsQ0F4QkEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuTm90aWZpY2F0aW9uLnJlcXVlc3RQZXJtaXNzaW9uKCk7XG5cbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnRnVsbHN0YWNrR2VuZXJhdGVkQXBwJywgWydmc2FQcmVCdWlsdCcsICd1aS5yb3V0ZXInLCAndWkuYm9vdHN0cmFwJywgJ25nQW5pbWF0ZSddKTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpO1xuICAgIC8vIFRyaWdnZXIgcGFnZSByZWZyZXNoIHdoZW4gYWNjZXNzaW5nIGFuIE9BdXRoIHJvdXRlXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLndoZW4oJy9hdXRoLzpwcm92aWRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsICRodHRwKSB7XG5cbiAgICAkaHR0cC5nZXQoJy9hcGkvcHJvZHVjdGlvbicpLnRoZW4ocmVzID0+IHtcbiAgICAgICAgd2luZG93LnByb2R1Y3Rpb24gPSByZXMuc3RhdHVzID09PSAyMDE7XG4gICAgICAgIHdpbmRvdy5yZWFkeSA9IHRydWU7XG4gICAgICAgIGlmKHdpbmRvdy5wcm9kdWN0aW9uKSB7XG4gICAgICAgICAgICB2YXIgbmlsRm4gPSBmdW5jdGlvbigpIHt9O1xuICAgICAgICAgICAgY29uc29sZS5sb2cgPSBuaWxGbjtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbyA9IG5pbEZuO1xuICAgICAgICAgICAgY29uc29sZS53YXJuID0gbmlsRm47XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yID0gbmlsRm47XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiKGZ1bmN0aW9uICgpIHtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgICBpZiAoIXdpbmRvdy5hbmd1bGFyKSB0aHJvdyBuZXcgRXJyb3IoJ0kgY2FuXFwndCBmaW5kIEFuZ3VsYXIhJyk7XG5cbiAgICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ2ZzYVByZUJ1aWx0JywgW10pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ1NvY2tldCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKTtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5pbyh3aW5kb3cubG9jYXRpb24ub3JpZ2luKTtcbiAgICB9KTtcblxuICAgIC8vIEFVVEhfRVZFTlRTIGlzIHVzZWQgdGhyb3VnaG91dCBvdXIgYXBwIHRvXG4gICAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICAgIGFwcC5jb25zdGFudCgnQVVUSF9FVkVOVFMnLCB7XG4gICAgICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgICAgICBsb2dvdXRTdWNjZXNzOiAnYXV0aC1sb2dvdXQtc3VjY2VzcycsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgICAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG5vdEF1dGhvcml6ZWQ6ICdhdXRoLW5vdC1hdXRob3JpemVkJ1xuICAgIH0pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMsIFN0b3JlKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSwgU3RvcmUpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm9uIHN1Y3JycnJyZXNzcyByZXMgOiBcIiwgcmVzcG9uc2UpXG4gICAgICAgICAgICBTdG9yZS5uZXdSZXMgPSByZXNwb25zZTtcbiAgICAgICAgICAgIGNoZWNrRm9yTG9jYWxTdG9yYWdlKHJlc3BvbnNlKVxuXG4gICAgICAgICAgICB2YXIgZGF0YSA9IFN0b3JlLm5ld1Jlcy5kYXRhO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJuZXcgZGFodGFhYSBcIiwgZGF0YSk7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZShkYXRhLmlkLCBkYXRhLnVzZXIpO1xuICAgICAgICAgICAgLy8gYWRkIHRoZSBwcm9maWxlIHRvIHRoZSBzdG9yZSBmYWN0b3J5LCB3aGljaCB3aWxsIGNvbnRpbnVlIHRvIHVwZGF0ZSB0aGUgdXNlciBkYXRhXG4gICAgICAgICAgICAvLyBTdG9yZS5wcm9maWxlID0gZGF0YS51c2VyLnByb2ZpbGU7XG4gICAgICAgICAgICBTdG9yZS5wcm9maWxlID0gZGF0YS51c2VyO1xuICAgICAgICAgICAgU3RvcmUudXNlciA9IGRhdGEudXNlciAmJiBkYXRhLnVzZXIuaWQ7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLmd1ZXN0TW9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS51c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuICAgICAgICBmdW5jdGlvbiBjaGVja0ZvckxvY2FsU3RvcmFnZShyZXNwb25zZVRvUGFzcykge1xuICAgICAgICAgICAgdmFyIGxvY2FsUHJvZmlsZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdwcm9maWxlJyk7XG4gICAgICAgICAgICBpZihsb2NhbFByb2ZpbGUpe1xuICAgICAgICAgICAgICAgIGxvY2FsUHJvZmlsZSA9IEpTT04ucGFyc2UobG9jYWxQcm9maWxlKTtcbiAgICAgICAgICAgICAgICAvLyBtZXJnZSBsb2NhbCBwcm9maWxlXG4gICAgICAgICAgICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS91c2VyL2xvY2FsUHJvZmlsZScsIHtsb2NhbFByb2ZpbGV9IClcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4obmV3UmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJUSEUgTkVXIFJFU09QT1NFRUVFRVwiLCBuZXdSZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ3VwZGF0ZS1jb250cm9sbGVyJywgbmV3UmVzcG9uc2UuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdwcm9maWxlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS5uZXdSZXMgPSBuZXdSZXNwb25zZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdSZXNwb25zZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgcmV0dXJuIChTdG9yZS5uZXdSZXMgPSByZXNwb25zZVRvUGFzcylcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nLCB7bG9naW5UaW1lOiBuZXcgRGF0ZSgpfSkudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7bWVzc2FnZTogJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJ30pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uIChzZXNzaW9uSWQsIHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBzZXNzaW9uSWQ7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KSgpO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnaG9tZScsIHtcbiAgICAgICAgdXJsOiAnLycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvaG9tZS9ob21lLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnSG9tZUN0cmwnLFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgICAgICB1c2VyOiBmdW5jdGlvbiAoQXV0aFNlcnZpY2UsICRyb290U2NvcGUsIFN0b3JlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKHVzZXIgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJVU0VSIFNUQVRVU1NTUyBcIiwgdXNlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0b3JlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1c2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyB1c2VyLCBkb2luZyBsb2NhbCBwcm9maWxlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgJHJvb3RTY29wZS5ndWVzdE1vZGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxvY2FsUHJvZmlsZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwicHJvZmlsZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbFByb2ZpbGUpIHJldHVybiBKU09OLnBhcnNlKGxvY2FsUHJvZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmluZm8oXCJubyBsb2NhbCBwcm9maWxlLCBjcmVhdGluZyBvbmUhXCIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3TG9jYWxQcm9maWxlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvbXNUb2RheTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b21hdG9NZXRlcjogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VuRGlhbDogU2QoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmNoaXZlOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmxvY2tlZEZlYXR1cmVzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0TG9nZ2VkSW46IERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBndWVzdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInByb2ZpbGVcIiwgSlNPTi5zdHJpbmdpZnkobmV3TG9jYWxQcm9maWxlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3TG9jYWxQcm9maWxlO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb2ZpbGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdGF0dXM6IDEwMCB9XG4gICAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0hvbWVDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgU3RvcmUsIHByb2ZpbGUsIHVzZXIsIFByb2ZpbGVVcGRhdGVyKSB7XG4gICAgY29uc29sZS5sb2coXCJ0aGUgdXNlcjogXCIsIHVzZXIpO1xuICAgICRzY29wZS5wcm9kdWN0aW9uID0gd2luZG93LnByb2R1Y3Rpb247XG5cbiAgICBpZiAocHJvZmlsZS5zdGF0dXMgPT09IDIwMikge1xuICAgICAgICBTdG9yZS5hcmNoaXZlVG9tc0VhdGVuKCk7XG4gICAgfVxuXG4gICAgJHNjb3BlLnVwZGF0ZUNvbnRyb2xsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgLnRoZW4obmV3VXNlciA9PiB7XG4gICAgICAgICAgICAgICAgdXNlciA9IG5ld1VzZXI7XG4gICAgICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgICAgIH0pXG4gICAgfTtcbiAgICAkc2NvcGUuJG9uKCd1cGRhdGUtY29udHJvbGxlcicsIGZ1bmN0aW9uIChldmVudCwgbmV3VXNlciwgZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImFuIGVycm9yIGhhcHBlbmVkISEhISFcIiwgbmV3VXNlcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5pbmZvKFwiW0hvbWVDdHJsXSBgdXBkYXRlLWNvbnRyb2xsZXJgIHRyaWdnZXJlZFwiLCBuZXdVc2VyKTtcbiAgICAgICAgdXNlciA9IG5ld1VzZXI7XG4gICAgICAgICRzY29wZS50b21hdG9NZXRlciA9IHVzZXIudG9tYXRvTWV0ZXIuY29uY2F0KHtjbGFzczogJ3dhaXQnLCB0ZXh0OiBcIi4uLlwifSk7XG4gICAgICAgIGFjdGl2ZUlkeCA9ICRzY29wZS50b21hdG9NZXRlci5sZW5ndGggLSAxO1xuICAgICAgICBjb21wbGV0ZWQgPSB1c2VyLnRvbXNUb2RheSB8fCAwO1xuICAgICAgICAvLyAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICAvLyAkc2NvcGUudXBkYXRlQ29udHJvbGxlcigpO1xuICAgIH0pO1xuXG4gICAgLy8gYXNzaWduIGN1cnJlbnQgc3RhdHMgdG8gcGljayB1cCB3aGVyZSB3ZSBsZWZ0IG9mZi5cbiAgICAkc2NvcGUuaXNHdWVzdCA9IHVzZXIuaXNHdWVzdDtcbiAgICAkc2NvcGUudG9tYXRvTWV0ZXIgPSB1c2VyLnRvbWF0b01ldGVyLmNvbmNhdCh7Y2xhc3M6ICd3YWl0JywgdGV4dDogXCIuLi5cIn0pO1xuICAgIGxldCBjb21wbGV0ZWQgPSB1c2VyLnRvbXNUb2RheSB8fCAwO1xuXG4gICAgLy8gc3R1ZmYgdGhhdCBoYXMgYSBsaWZlY3ljbGVcbiAgICAkc2NvcGUuc3RhdGUgPSB7XG4gICAgICAgIHN0YXRlOiBcIk9GRlwiLFxuICAgICAgICB0aW1lclJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICB0aW1lclBhdXNlZDogZmFsc2UsXG4gICAgICAgIG9uQnJlYWs6IGZhbHNlLFxuICAgICAgICBlZGl0aW5nOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogXCJcIixcbiAgICAgICAgc3RhbmRieVRpbWVyOiBudWxsLFxuICAgICAgICBicmVha1RpbWVyOiBudWxsLFxuICAgIH07XG4gICAgbGV0IHN0YXRlID0gJHNjb3BlLnN0YXRlOyAvLyBmb3IgYmV0dGVyIHJlYWRhYmlsaXR5LlxuICAgIHZhciB0aW1lciA9IHtjbGVhclRpbWVyOiAoKSA9PiBudWxsfTsgLy8gdG8gcHJldmVudCBpbnZva2luZyB0aGUgZnVuY3Rpb24gb24gYW4gdW5kZWZpbmVkIG9uIGZpcnN0IGNhbGw7XG4gICAgbGV0IHRpdGxlQ2FjaGU7XG5cbiAgICBsZXQgZ2V0R29hbCA9ICgpID0+ICRzY29wZS5nb2FsIHx8IFwiZWF0aW5nIGEgdG9tYXRvXCI7XG5cbiAgICAkc2NvcGUuZ2V0Q29tcGxldGVkID0gKCkgPT4gY29tcGxldGVkO1xuICAgICRzY29wZS5nZXRUb3RhbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFN0b3JlLmdldFRvdGFsVG9tcyh1c2VyKTtcbiAgICB9XG5cbiAgICAvLyAkc2NvcGUuZ29hbCA9IFwiXCI7XG5cblxuICAgICRzY29wZS50aW1lID0gXCIwOjAwXCI7XG4gICAgLy8gJHNjb3BlLnN0YXRlLm9uQnJlYWsgPSAoKSA9PiAkc2NvcGUuc3RhdGUub25CcmVhaztcbiAgICBsZXQgYWN0aXZlSWR4ID0gKCRzY29wZS50b21hdG9NZXRlci5sZW5ndGggLSAxKSB8fCAwO1xuXG4gICAgJHNjb3BlLnN0YXJ0SW5pdGlhbCA9IGZ1bmN0aW9uIChkb250U3RvcFRpbWVyKSB7XG4gICAgICAgIGRvbnRTdG9wVGltZXIgfHwgdGltZXIuY2xlYXJUaW1lcigpO1xuXG4gICAgfVxuXG4gICAgJHNjb3BlLnN0YXJ0VGltZXIgPSBmdW5jdGlvbiAodGltZSA9IFsyNSwgMF0sIGNvbXBsZXRlRm4sIGludGVydmFsRm4pIHtcbiAgICAgICAgaW50ZXJ2YWxGbiA9IGludGVydmFsRm4gfHwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIGFzc2lnbiBzY29wZSBhbmQgZG9jdW1lbnQgdGl0bGUgaW4gb25lIGdvXG4gICAgICAgICAgICAgICAgaWYoc3RhdGUuc3RhdGUgPT09IFwiUE9NT0JPUk9cIikgZG9jdW1lbnQudGl0bGUgPSBcIltcIiArICgkc2NvcGUudGltZSA9IHRpbWVyLmdldE1pbnMoKSArIFwiOlwiICsgdGltZXIuZ2V0U2VjcygpKSArIFwiXSDCqyBcIiArIGdldEdvYWwoKTtcbiAgICAgICAgICAgICAgICBpZihzdGF0ZS5zdGF0ZSA9PT0gXCJCUkVBS1wiIHx8IHN0YXRlLnN0YXRlID09PSBcIkxPTkdfQlJFQUtcIikgZG9jdW1lbnQudGl0bGUgPSBcIltcIiArICgkc2NvcGUudGltZSA9IHRpbWVyLmdldE1pbnMoKSArIFwiOlwiICsgdGltZXIuZ2V0U2VjcygpKSArIFwiXSDCqyBCUkVBS1wiO1xuICAgICAgICAgICAgICAgICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICBjb25zb2xlLmxvZyhcIklOVEVSVkFMIEZOIFwiLCAgaW50ZXJ2YWxGbik7XG4gICAgICAgIHRpbWVyLmNsZWFyVGltZXIoKVxuICAgICAgICB0aW1lciA9IG5ldyBUaW1lcih0aW1lLCBjb21wbGV0ZUZuLCBpbnRlcnZhbEZuKTtcbiAgICAgICAgaWYoc3RhdGUuc3RhdGUgPT09IFwiUE9NT0RPUk9cIikgZG9jdW1lbnQudGl0bGUgPSBcIltcIiArICgkc2NvcGUudGltZSA9IFwiMjU6MDBcIikgKyBcIl0gwqsgXCIgKyBnZXRHb2FsKCk7XG4gICAgfTtcblxuICAgICRzY29wZS5zdGFydFBvbW9kb3JvID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9IFwibnVsbFwiO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHN0YXRlLnN0YXRlID0gJ1BPTU9ET1JPJywgMTAwMCk7XG4gICAgICAgIHN0YXRlLnRpbWVyUnVubmluZyA9IHRydWU7XG5cbiAgICAgICAgbGV0IGFjdGl2ZVRvbSA9ICRzY29wZS50b21hdG9NZXRlclthY3RpdmVJZHhdO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSAnYWN0aXZlJztcbiAgICAgICAgYWN0aXZlVG9tLnRleHQgPSBjb21wbGV0ZWQgKyAxO1xuXG4gICAgICAgIGxldCBjb21wbGV0ZUZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmhpZGRlbikgbmV3IE5vdGlmaWNhdGlvbihcIlBvbW9kb3JvIGNvbXBsZXRlXCIsIHtcbiAgICAgICAgICAgICAgICBib2R5OiBcIlRha2UgYSA1IG1pbnV0ZSBicmVhayBvciBzZWxlY3Qgb3RoZXIgb3B0aW9uc1wiLFxuICAgICAgICAgICAgICAgIGljb246IFwiL3B1YmxpYy90b21hdG8ucG5nXCJcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgJHNjb3BlLl9tYXJrQ29tcGxldGUoKTtcbiAgICAgICAgICAgICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgICAgICByZXR1cm4gJHNjb3BlLnN0YXJ0QnJlYWsoWzUsMF0pO1xuICAgICAgICB9O1xuICAgICAgICBsZXQgaW50ZXJ2YWxGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIGFzc2lnbiBzY29wZSBhbmQgZG9jdW1lbnQgdGl0bGUgaW4gb25lIGdvXG4gICAgICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwiW1wiICsgKCRzY29wZS50aW1lID0gdGltZXIuZ2V0TWlucygpICsgXCI6XCIgKyB0aW1lci5nZXRTZWNzKCkpICsgXCJdIMKrIFwiICsgZ2V0R29hbCgpO1xuICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgfTtcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9IFwiRm9jdXMgdGltZSFcIjtcbiAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIltcIiArICgkc2NvcGUudGltZSA9IFwiMjU6MDBcIikgKyBcIl0gwqsgXCIgKyBnZXRHb2FsKCk7XG4gICAgICAgICRzY29wZS5zdGFydFRpbWVyKFsyNSwwXSwgY29tcGxldGVGbiwgaW50ZXJ2YWxGbilcbiAgICB9O1xuXG4gICAgJHNjb3BlLnN0YXJ0QnJlYWsgPSBmdW5jdGlvbiAodGltZSA9IFs1LDBdKSB7XG4gICAgICAgIHN0YXRlLnN0YXRlID0gJ251bGwnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHN0YXRlLnN0YXRlID0gJ0JSRUFLJywgMTAwMCk7XG4gICAgICAgIHN0YXRlLnRpbW1lclJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgc3RhdGUub25CcmVhayA9IHRydWU7XG4gICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBcIllvdSdyZSBvbiBhIGJyZWFrISBZb3UgY2FuIHR1cm4gdGhpcyBpbnRvIGEgbG9uZyBicmVhayBvciBzdGFydCBhIG5ldyBQb21vZG9ybyB3aXRoIHRoZSBidXR0b25zIGJlbG93LlwiO1xuICAgICAgICBsZXQgY29tcGxldGVGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIG5ldyBOb3RpZmljYXRpb24oXCJCcmVhayBvdmVyIVwiLCB7XG4gICAgICAgICAgICAgICAgYm9keTogXCJTdGFydCBhbm90aGVyIHBvbW9kb3JvLCBvciB0YWtlIGEgbG9uZyBicmVhay5cIixcbiAgICAgICAgICAgICAgICBpY29uOiBcIi9wdWJsaWMvdG9tYXRvLnBuZ1wiXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICRzY29wZS5wb3N0QnJlYWsoKTtcbiAgICAgICAgfTtcbiAgICAgICAgJHNjb3BlLnN0YXJ0VGltZXIodGltZSwgY29tcGxldGVGbik7XG4gICAgfTtcbiAgICAkc2NvcGUucG9zdEJyZWFrID0gZnVuY3Rpb24gKHRpbWUgPSBbMSwgMzBdKSB7XG4gICAgICAgIHN0YXRlLnN0YXRlID0gJ251bGwnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHN0YXRlLnN0YXRlID0gXCJQT1NUX0JSRUFLXCIsMTAwMCk7XG4gICAgICAgIGxldCBmb3JjZUJyZWFrRm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuc3RhcnRMb25nQnJlYWsoWzEzLDMwXSwgdHJ1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBcIlNlbGVjdCB3aGF0IHRvIGRvIG5leHQuIFdlIHdpbGwgc3RhcnQgYSBicmVhayBpbiAxOjMwXCI7XG4gICAgICAgIHN0YXRlLnRpbWVyUnVubmluZyA9IGZhbHNlO1xuICAgICAgICB0aW1lciA9IG5ldyBUaW1lcih0aW1lLGZvcmNlQnJlYWtGbiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHN0YW5kYnlUaW1lID0gdGltZXIuZ2V0TWlucygpICsgXCI6XCIgKyB0aW1lci5nZXRTZWNzKCk7XG4gICAgICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJTZWxlY3Qgd2hhdCB0byBkbyBuZXh0LiBUaGlzIGF1dG9tYXRpY2FsbHkgYmVjb21lcyBhIGxvbmcgYnJlYWsgaW4gXCIgKyBzdGFuZGJ5VGltZTtcbiAgICAgICAgICAgICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgJHNjb3BlLnN0YXJ0TG9uZ0JyZWFrID0gZnVuY3Rpb24gKHRpbWUgPSBbMTUsIDBdLCBmb3JjZWQpIHtcbiAgICAgICAgc3RhdGUuc3RhdGUgPSBcIkxPTkdfQlJFQUtcIjtcbiAgICAgICAgJHNjb3BlLl9tYXJrTG9uZ0JyZWFrU3RhcnQoKTtcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9IGZvcmNlZCA/IFwiWW91J3ZlIGJlZW4gaWRsZSBmb3IgYSB3aGlsZS4gU28gd2UndmUgbWFkZSB0aGlzIGEgbG9uZyBicmVha1wiXG4gICAgICAgICAgICA6IFwiUmVsYXggZm9yIGEgd2hpbGUsIG9yIHN0YXJ0IGFub3RoZXIgUG9tb2Rvcm8gaWYgeW91J3JlIHJlYWR5LlwiO1xuICAgICAgICAkc2NvcGUuc3RhcnRUaW1lcih0aW1lICxmdW5jdGlvbigpe1xuICAgICAgICAgICAgJHNjb3BlLl9tYXJrTG9uZ0JyZWFrQ29tcGxldGUoKTtcbiAgICAgICAgICAgICRzY29wZS5wb3N0QnJlYWsoKVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLnN0b3BDdXJyZW50VGltZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRpbWVyLmNsZWFySW50ZXJ2YWwoKTtcbiAgICB9O1xuXG5cblxuICAgICRzY29wZS50b2dnbGVQYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aW1lcikgIHJldHVybjtcblxuICAgICAgICB0aW1lci50b2dnbGVQYXVzZSgpO1xuICAgICAgICBzdGF0ZS50aW1lclBhdXNlZCA9ICFzdGF0ZS50aW1lclBhdXNlZDtcbiAgICAgICAgaWYgKCF0aXRsZUNhY2hlKSB7XG4gICAgICAgICAgICB0aXRsZUNhY2hlID0gZG9jdW1lbnQudGl0bGU7XG4gICAgICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwi4paQ4paQIFwiICsgZG9jdW1lbnQudGl0bGU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkb2N1bWVudC50aXRsZSA9IHRpdGxlQ2FjaGU7XG4gICAgICAgICAgICB0aXRsZUNhY2hlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8vLyBJTlRFUk5BTCBMT0dJQyAvLy9cbiAgICAvLyBUT0RPIHRoaXMgc3R1ZmYgc2hvdWxkIGJlIG1vdmVkIG9mZiB0aGUgc2NvcGUgYW5kIHB1dCBpbnRvIGFwcm9wcmlhdGUgdGltZW91dHMuXG5cbiAgICAkc2NvcGUuX21hcmtDb21wbGV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV0IGFjdGl2ZVRvbSA9ICRzY29wZS50b21hdG9NZXRlclthY3RpdmVJZHhdO1xuICAgICAgICAvLyBtYXJrIHRoZSBwZW5kaW5nIHRvbSBjb21wbGV0ZVxuICAgICAgICBhY3RpdmVUb20udGV4dCA9IGNvbXBsZXRlZCArIDE7IC8vZm9yIGh1bWFuIHJlYWRibGUgMS1pbmRleGluZ1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSAnY29tcGxldGUnO1xuXG4gICAgICAgIGNvbXBsZXRlZCsrO1xuICAgICAgICBhY3RpdmVJZHgrKztcbiAgICAgICAgLy8gJHNjb3BlLnRvbWF0b01ldGVyLnB1c2goe2NsYXNzOiAnd2FpdCcsIHRleHQ6ICcuLi4nfSlcblxuICAgICAgICBQcm9maWxlVXBkYXRlci5wdXNoVG9tYXRvTWV0ZXIoYWN0aXZlVG9tKTtcbiAgICAgICAgLy8gLnRoZW4ocmVzID0+IGNvbnNvbGUuaW5mbyhcIltob21lLmpzOm1hcmtDb3BsZXRlXSB1c2VyIHByb2ZpbGUgdXBkYXRlZFwiLCByZXMpKTtcbiAgICAgICAgLy8gU3RvcmUucHJvZmlsZS50b21zRWF0ZW4udG9kYXkrKztcbiAgICB9O1xuXG4gICAgJHNjb3BlLl9tYXJrTG9uZ0JyZWFrU3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBhY3RpdmVUb20gPSAkc2NvcGUudG9tYXRvTWV0ZXJbYWN0aXZlSWR4XTtcbiAgICAgICAgYWN0aXZlVG9tLnRleHQgPSBcIiNicmVhayNcIjtcbiAgICAgICAgYWN0aXZlVG9tLmNsYXNzID0gJ2JyZWFrJztcbiAgICAgICAgJHNjb3BlLnN0YXRlLm9uQnJlYWsgPSB0cnVlO1xuICAgIH07XG4gICAgJHNjb3BlLl9tYXJrTG9uZ0JyZWFrQ29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJQb21vZG9ybyFcIjtcbiAgICAgICAgJHNjb3BlLnRpbWUgPSBcIjooXCI7XG4gICAgICAgIGxldCBhY3RpdmVUb20gPSAkc2NvcGUudG9tYXRvTWV0ZXJbYWN0aXZlSWR4XTtcbiAgICAgICAgYWN0aXZlSWR4Kys7XG4gICAgICAgIGFjdGl2ZVRvbS5jbGFzcyA9IFwiYnJlYWsgY29tcGxldGVcIjtcbiAgICAgICAgUHJvZmlsZVVwZGF0ZXIucHVzaFRvbWF0b01ldGVyKGFjdGl2ZVRvbSk7XG4gICAgfTtcbiAgICAkc2NvcGUuX21hcmtGYWlsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmKCFjb25maXJtKFwiTWFyayBwb21vZG9ybyBhcyBmYWlsZWQ/XCIpKSByZXR1cm47XG4gICAgICAgIHN0YXRlLnN0YXRlID0gJ251bGwnO1xuICAgICAgICBzdGF0ZS5tZXNzYWdlID0gJ01hcmtpbmcgZmFpbGVkLi4uJztcbiAgICAgICAgJHNjb3BlLmdvYWwgPSAnJztcbiAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIlBvbW9kb3JvIVwiO1xuICAgICAgICAkc2NvcGUudGltZSA9IFwiMDowMFwiO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHN0YXRlLnN0YXRlID0gJ09GRic7XG4gICAgICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJTdGFydCBhIG5ldyBwb21vZG9ybyB3aGVuIHJlYWR5LlwiO1xuICAgICAgICAgICAgJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgfSwxMDAwKTtcbiAgICAgICAgbGV0IGFjdGl2ZVRvbSA9ICRzY29wZS50b21hdG9NZXRlclthY3RpdmVJZHhdO1xuICAgICAgICBhY3RpdmVJZHgrKztcbiAgICAgICAgYWN0aXZlVG9tLmNsYXNzID0gJ2ZhaWwnO1xuICAgICAgICBhY3RpdmVUb20udGV4dCA9ICdYJztcbiAgICAgICAgUHJvZmlsZVVwZGF0ZXIucHVzaFRvbWF0b01ldGVyKGFjdGl2ZVRvbSk7XG4gICAgICAgIHRpbWVyLmNsZWFyVGltZXIoKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLmRlbGV0ZVRvbWF0b01ldGVyID0gUHJvZmlsZVVwZGF0ZXIuZGVsZXRlVG9tYXRvTWV0ZXI7XG4gICAgJHNjb3BlLmFyY2hpdmVUb21hdG9NZXRlciA9IFByb2ZpbGVVcGRhdGVyLmFyY2hpdmVUb21hdG9NZXRlcjtcblxuXG4gICAgbGV0ICRpbnB1dEdvYWwgPSAkKCdpbnB1dC5nb2FsJyksXG4gICAgICAgICRwbGFjZWhvbGRlciA9ICQoJyNwbGFjZWhvbGRlcicpLFxuICAgICAgICAkZ29hbElucHV0ID0gJCgnI2dvYWxJbnB1dCcpO1xuXG4gICAgJHNjb3BlLnRvZ2dsZUVkaXQgPSAoKSA9PiB7XG4gICAgICAgICRwbGFjZWhvbGRlci5oaWRlKCk7XG4gICAgICAgICRnb2FsSW5wdXQuc2hvdygpO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnb2FsSW5wdXQnKS5mb2N1cygpLCAwKTtcbiAgICB9O1xuICAgICRnb2FsSW5wdXQuYmx1cigoKSA9PiB7XG4gICAgICAgIGlmICghJHNjb3BlLmdvYWwpIHtcbiAgICAgICAgICAgICRnb2FsSW5wdXQuaGlkZSgpO1xuICAgICAgICAgICAgJHBsYWNlaG9sZGVyLnNob3coKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgICRnb2FsSW5wdXQua2V5cHJlc3MoZSA9PiB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImZpbmlzaCBlZGl0XCIpO1xuICAgICAgICAgICAgJGlucHV0R29hbC5ibHVyKCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICAvL3RvbWF0byBidXR0b24gY29udHJvbHNcbiAgICBzZXRUaW1lb3V0KCRzY29wZS4kZGlnZXN0KTtcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbGVhcm4nLCB7XG4gICAgICAgIHVybDogJy9sZWFybicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnL2pzL2xlYXJuL2xlYXJuLmh0bWwnLFxuICAgIH0pXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgJHJvb3RTY29wZSwgJHdpbmRvdykge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5nb0JhY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICR3aW5kb3cuaGlzdG9yeS5iYWNrKCk7XG4gICAgfVxuXG4gICAgJHNjb3BlLnNlbmRMb2dpbiA9IGZ1bmN0aW9uIChsb2dpbkluZm8pIHtcblxuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhcInNldHRpbmcgZ3Vlc3QgbW9kZSB0byBmYWxzZSBcIik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLmd1ZXN0TW9kZSA9IGZhbHNlO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICB9KTtcblxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZScsIHtcbiAgICAgICAgdXJsOiAnL21lJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICcvanMvbXktc3R1ZmYvbXktc3R1ZmYuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdteVN0dWZmJyxcbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBkYXRhLmF1dGhlbnRpY2F0ZSBpcyByZWFkIGJ5IGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIC8vIHRoYXQgY29udHJvbHMgYWNjZXNzIHRvIHRoaXMgc3RhdGUuIFJlZmVyIHRvIGFwcC5qcy5cbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgYXV0aGVudGljYXRlOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgIHVzZXI6IGZ1bmN0aW9uIChTdG9yZSwgQXV0aFNlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICBpZihTdG9yZS51c2VyKSByZXR1cm4gU3RvcmUudXNlcjtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4odXNlciA9PiB1c2VyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ215U3R1ZmYnLCBmdW5jdGlvbiAoJHNjb3BlLCB1c2VyKSB7XG4gICAgY29uc29sZS5sb2coXCIjIyMjI1wiICwgdXNlcik7XG4gICAgJHNjb3BlLmFyY2hpdmUgPSB1c2VyLmFyY2hpdmUuc2xpY2UoKS5yZXZlcnNlKCk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ1NlY3JldFN0YXNoJywgZnVuY3Rpb24gKCRodHRwKSB7XG5cbiAgICB2YXIgZ2V0U3Rhc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVtYmVycy9zZWNyZXQtc3Rhc2gnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZXRTdGFzaDogZ2V0U3Rhc2hcbiAgICB9O1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2RvY3MnLCB7XG4gICAgICAgIHVybDogJy9kb2NzJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9kb2NzL2RvY3MuaHRtbCdcbiAgICB9KTtcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgIC8vIFJlZ2lzdGVyIG91ciAqYWJvdXQqIHN0YXRlLlxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdhYm91dCcsIHtcbiAgICAgICAgdXJsOiAnL2Fib3V0JyxcbiAgICAgICAgY29udHJvbGxlcjogJ0Fib3V0Q29udHJvbGxlcicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvYWJvdXQvYWJvdXQuaHRtbCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdBYm91dENvbnRyb2xsZXInLCBmdW5jdGlvbiAoJHNjb3BlLCBGdWxsc3RhY2tQaWNzKSB7XG5cbiAgICAvLyBJbWFnZXMgb2YgYmVhdXRpZnVsIEZ1bGxzdGFjayBwZW9wbGUuXG4gICAgJHNjb3BlLmltYWdlcyA9IF8uc2h1ZmZsZShGdWxsc3RhY2tQaWNzKTtcblxufSk7IiwiYXBwLmZhY3RvcnkoJ0Z1bGxzdGFja1BpY3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CN2dCWHVsQ0FBQVhRY0UuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vZmJjZG4tc3Bob3Rvcy1jLWEuYWthbWFpaGQubmV0L2hwaG90b3MtYWsteGFwMS90MzEuMC04LzEwODYyNDUxXzEwMjA1NjIyOTkwMzU5MjQxXzgwMjcxNjg4NDMzMTI4NDExMzdfby5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItTEtVc2hJZ0FFeTlTSy5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3OS1YN29DTUFBa3c3eS5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItVWo5Q09JSUFJRkFoMC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I2eUl5RmlDRUFBcWwxMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFLVQ3NWxXQUFBbXFxSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFdlpBZy1WQUFBazkzMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFZ05NZU9YSUFJZkRoSy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFUXlJRE5XZ0FBdTYwQi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NDRjNUNVFXOEFFMmxHSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBZVZ3NVNXb0FBQUxzai5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBYUpJUDdVa0FBbElHcy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBUU93OWxXRUFBWTlGbC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItT1FiVnJDTUFBTndJTS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I5Yl9lcndDWUFBd1JjSi5wbmc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I1UFRkdm5DY0FFQWw0eC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I0cXdDMGlDWUFBbFBHaC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0IyYjMzdlJJVUFBOW8xRC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0J3cEl3cjFJVUFBdk8yXy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0JzU3NlQU5DWUFFT2hMdy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NKNHZMZnVVd0FBZGE0TC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJN3d6akVWRUFBT1BwUy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJZEh2VDJVc0FBbm5IVi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NHQ2lQX1lXWUFBbzc1Vi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJUzRKUElXSUFJMzdxdS5qcGc6bGFyZ2UnXG4gICAgXTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1Byb2ZpbGVVcGRhdGVyJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy93cnBwZXIgZm9yICRodHRwIHRoYXQgYXV0b21hdHVjYWxseSBicm9hZGNhc3RzIGFuIGV2ZW50IChzbyB3ZSBkb24ndCBoYXZlIHRvIGtlZXAgY2FsbGluZyBpdC4gU2x5IGFuZCBEUlkpXG4gIGxldCBodHRwID0gZnVuY3Rpb24gKG1ldGhvZCwgdXJsLCBib2R5KSB7XG5cbiAgICBpZigkcm9vdFNjb3BlLmd1ZXN0TW9kZSkge1xuICAgICAgY29uc29sZS5pbmZvKFwiR3Vlc3QgbW9kZSBpcyBhY3RpdmUuIFVzaW5nIGxvY2FsIHN0b3JhZ2VcIilcbiAgICAgIHJldHVybiBsb2NhbEFjdGlvbigobWV0aG9kICsgdXJsKSwgYm9keSk7XG4gICAgfVxuXG4gICAgcmV0dXJuICRodHRwW21ldGhvZC50b0xvd2VyQ2FzZSgpXSh1cmwsIGJvZHkpXG4gICAgICAudGhlbihyZXMgPT4gJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIHJlcy5kYXRhKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIGVyci5kYXRhLCB0cnVlKSlcbiAgfTtcbiAgbGV0IGxvY2FsQWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbiwgcGF5bG9hZCkge1xuICAgIGNvbnNvbGUubG9nKFwiZ2V0dGluZyBhIHByb2ZpbGUgZnJvbSBsb2NhbCBzdG9yYWdlXCIpXG4gICAgbGV0IHByb2ZpbGUgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdwcm9maWxlJykpO1xuICAgIGNvbnNvbGUubG9nKFwidGhlIHByb2ZpbGUgd2UgZ290XCIsIHByb2ZpbGUpXG4gICAgc3dpdGNoIChhY3Rpb24pe1xuICAgICAgY2FzZSAnUFVUL2FwaS91c2VyL3RvbWF0b01ldGVyJzpcbiAgICAgICAgcHJvZmlsZS50b21hdG9NZXRlci5wdXNoKHBheWxvYWQudG9tYXRvKTtcbiAgICAgICAgaWYocGF5bG9hZC50b21hdG8uY2xhc3MgPT09ICdjb21wbGV0ZScpIHByb2ZpbGUudG9tc1RvZGF5Kys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnUE9TVC9hcGkvdXNlci90b21hdG9NZXRlci9hcmNoaXZlJzpcbiAgICAgICAgcHJvZmlsZS5hcmNoaXZlLnB1c2goe1xuICAgICAgICAgIGRhdGU6IFNkLmNvbnZlcnRTZChwcm9maWxlLnN1bkRpYWwpLFxuICAgICAgICAgIHRvbWF0b01ldGVyOiBwcm9maWxlLnRvbWF0b01ldGVyXG4gICAgICAgIH0pO1xuICAgICAgICBwcm9maWxlLnRvbWF0b01ldGVyID0gW107XG4gICAgICAgIHByb2ZpbGUudG9tc1RvZGF5ID0gMDtcbiAgICAgICAgcHJvZmlsZS5zdW5EaWFsID0gU2QoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKFwidGhlIG5ldyBwcm9maWxlXCIsIHByb2ZpbGUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdwcm9maWxlJywgSlNPTi5zdHJpbmdpZnkocHJvZmlsZSkpO1xuICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgndXBkYXRlLWNvbnRyb2xsZXInLCBwcm9maWxlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcHVzaFRvbWF0b01ldGVyOiBmdW5jdGlvbiAodG9tYXRvKSB7XG4gICAgICAvLyBzdHVmZiBnb2VzIGhlcmVcbiAgICAgIGNvbnNvbGUubG9nKFwid2hhdCBpcyB0aGUgc2Vzc2lvbiBhbnl3aG8gPz9cIiwgU2Vzc2lvbik7XG4gICAgICByZXR1cm4gaHR0cCgnUFVUJywgJy9hcGkvdXNlci90b21hdG9NZXRlcicsIHtcbiAgICAgICAgdXNlcjogU2Vzc2lvbi51c2VyICYmIFNlc3Npb24udXNlci5faWQsIC8vVE9ETzogcmVtb3ZlIGFuZCB1c2UgdGhlIHVzZXIgb24gdGhlIHJlcS5ib2R5IGZyb20gYmFja2VuZFxuICAgICAgICB0b21hdG8sXG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZVRvbWF0b01ldGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBkZWxldGVzIHRoZSBjdXJyZW50IHRvbWF0byBtZXRlciBvZiB0aGUgZGF5LlxuICAgICAgcmV0dXJuIGh0dHAoJ0RFTEVURScsICcvYXBpL3VzZXIvdG9tYXRvTWV0ZXI/dXNlcj0nICsgU2Vzc2lvbi51c2VyLl9pZCk7XG4gICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL3VzZXIvdG9tYXRvTWV0ZXI/dXNlcj0nICsgU2Vzc2lvbi51c2VyLl9pZCk7XG4gICAgfSxcbiAgICBhcmNoaXZlVG9tYXRvTWV0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGFsZXJ0KFwiaGl0IHRoZSB0b21hdG8gbWV0ZXJcIilcbiAgICAgIHJldHVybiBodHRwKCdQT1NUJywgJy9hcGkvdXNlci90b21hdG9NZXRlci9hcmNoaXZlJyk7XG4gICAgfSxcbiAgfVxufSk7XG4iLCJhcHAuZmFjdG9yeSgnUmFuZG9tR3JlZXRpbmdzJywgZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGdldFJhbmRvbUZyb21BcnJheSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XG4gICAgfTtcblxuICAgIHZhciBncmVldGluZ3MgPSBbXG4gICAgICAgICdIZWxsbywgd29ybGQhJyxcbiAgICAgICAgJ0F0IGxvbmcgbGFzdCwgSSBsaXZlIScsXG4gICAgICAgICdIZWxsbywgc2ltcGxlIGh1bWFuLicsXG4gICAgICAgICdXaGF0IGEgYmVhdXRpZnVsIGRheSEnLFxuICAgICAgICAnSVxcJ20gbGlrZSBhbnkgb3RoZXIgcHJvamVjdCwgZXhjZXB0IHRoYXQgSSBhbSB5b3Vycy4gOiknLFxuICAgICAgICAnVGhpcyBlbXB0eSBzdHJpbmcgaXMgZm9yIExpbmRzYXkgTGV2aW5lLicsXG4gICAgICAgICfjgZPjgpPjgavjgaHjga/jgIHjg6bjg7zjgrbjg7zmp5jjgIInLFxuICAgICAgICAnV2VsY29tZS4gVG8uIFdFQlNJVEUuJyxcbiAgICAgICAgJzpEJyxcbiAgICAgICAgJ1llcywgSSB0aGluayB3ZVxcJ3ZlIG1ldCBiZWZvcmUuJyxcbiAgICAgICAgJ0dpbW1lIDMgbWlucy4uLiBJIGp1c3QgZ3JhYmJlZCB0aGlzIHJlYWxseSBkb3BlIGZyaXR0YXRhJyxcbiAgICAgICAgJ0lmIENvb3BlciBjb3VsZCBvZmZlciBvbmx5IG9uZSBwaWVjZSBvZiBhZHZpY2UsIGl0IHdvdWxkIGJlIHRvIG5ldlNRVUlSUkVMIScsXG4gICAgXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGdyZWV0aW5nczogZ3JlZXRpbmdzLFxuICAgICAgICBnZXRSYW5kb21HcmVldGluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFJhbmRvbUZyb21BcnJheShncmVldGluZ3MpO1xuICAgICAgICB9XG4gICAgfTtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnU3RvcmUnLCBmdW5jdGlvbiAoJGxvZykge1xuXG4gICAgLy9UT0RPOiBvbmNlIHVzZXJzIGlzIGltcGxpbWVudGVkLCB0aGUgYmVsb3cgZGVmYXVsdFN0b3JlIHdpbGwgb25seSBiZSByZXR1cmVkIGlmIHVzZXIgaXMgbm90IGxvZ2dlZCBpblxuICAgIC8vIHRoaXMgaXMgdGhlIHN0YXJ0bmcgdXNlciBzdGF0ZSBhbmQgd2lsbCBiZSBtb2RpZmVkIGZvciBhcyBsb25nIGFzIHNlc3Npb24gaXMgYWN0aXZlLiBXaGVuIGEgdXNlciBzaWducyB1cCxcbiAgICAvLyBhbnkgcHJvZ3Jlc3MgZnJvbSBoZXJlIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSB1c2VyIGNyZWF0aW9uLlxuXG4gICAgbGV0IFN0b3JlID0ge1xuICAgICAgICAvL1RPRE8gbmVlZCB0byBmaW5kIGEgYmV0dGVyIHdheSB0byB1cGRhdGUgdGhlIHN0b3JlXG4gICAgICAgIG5ld1JlczogbnVsbCxcbiAgICAgICAgdXNlcjogbnVsbCxcbiAgICAgICAgcHJvZmlsZToge1xuICAgICAgICAgICAgYXJjaGl2ZTogW10sXG4gICAgICAgICAgICB0b21zRWF0ZW46IHtcbiAgICAgICAgICAgICAgICB0b2RheTogMCxcbiAgICAgICAgICAgICAgICB0b21hdG9NZXRlcjogW10sXG4gICAgICAgICAgICAgICAgYXJjaGl2ZTogW1xuICAgICAgICAgICAgICAgICAgICAvL1RPRE86IFJFTU9WRSBvbiA4LzI1XG4gICAgICAgICAgICAgICAgICAgIC8ve2RhdGU6IERhdGUsIHRvdGFsOiAwLCB0b21hdG9NZXRlcjogezx0b21hdG9NZXRlcj59IH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGdldFRvdGFsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi5hcmNoaXZlLm1hcCh0ID0+IHQudG90YWwpLnJlZHVjZSgocCwgbikgPT4gcCArIG4sIFN0b3JlLnByb2ZpbGUudG9tc1RvZGF5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHVubG9ja2VkRmVhdHVyZXM6IFtdLFxuICAgICAgICBmZWF0dXJlczogW1xuICAgICAgICAgICAge25hbWU6IFwiZ29hbFNldHRlclwiLCB1bmxvY2tBdDogMSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJ0b2RvXCIsIHVubG9ja0F0OiAzLCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcIm1hcmtGYWlsXCIsIHVubG9ja0F0OiB7ZGF5c0NvbXBsZXRlOiAyfSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJzbmFrZVwiLCB1bmxvY2tBdDogOCwgdHlwZTogXCJnYW1lXCIsIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJ9LFxuICAgICAgICAgICAge25hbWU6IFwicGxheWxpc3RcIiwgdW5sb2NrQXQ6IHt0b21zVG9kYXk6IDh9LCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcImdvYWxTZXR0b3JcIiwgdW5sb2NrQXQ6IHtzdHJlYWs6IDN9LCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcInRldHJpc1wiLCB1bmxvY2tBdDogNDQsIHR5cGU6IFwiZ2FtZVwiLCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImRhcmtUaGVtZVwiLFxuICAgICAgICAgICAgICAgIHVubG9ja0F0OiB7ZGF5c0NvbXBsZXRlOiAzMH0sXG4gICAgICAgICAgICAgICAgdW5sb2NrRm46ICgpID0+IChuZXcgRGF0ZSgpKS5nZXRIb3VycygpID4gMTgsXG4gICAgICAgICAgICAgICAgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtuYW1lOiBcIjEwMDB0b21zUGFnZVwiLCB1bmxvY2tBdDogMTAwMCwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgIF0sXG4gICAgICAgIGdldFRvdGFsVG9tczogKHVzZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBfLnN1bSh1c2VyLmFyY2hpdmUubWFwKGkgPT4gaS50b21hdG9NZXRlci5maWx0ZXIodCA9PiB0LmNsYXNzID09PSAnY29tcGxldGUnKS5sZW5ndGgpKSArICh1c2VyLnRvbXNUb2RheSB8fCAwKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibWV0ZXI/Pz8gXCIsIGFyY2hpdmVUb3RhbHMpXG4gICAgICAgICAgICByZXR1cm4gdXNlci5hcmNoaXZlLnJlZHVjZSgocCwgdG9tYXRvU2VyaWVzKSA9PiB0b21hdG9TZXJpZXMudG9tYXRvTW90ZXIucmVkdWNlKChwLCB0KSA9PiAodC5jbGFzcyA9PT0gJ2NvbXBsZXRlJyA/IDE6MCkgKyBwLDApXG4gICAgICAgICAgICAgICAgKyBwLDApXG4gICAgICAgICAgICAgICAgKyB1c2VyLnRvbXNUb2RheSB8fCAwO1xuICAgICAgICB9LFxuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChuZXdQcm9wcykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgLy8gbW92ZSB0aGlzIHNvbWV3aGVyZSBlbHNlXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpXG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS91c2VyLycsIHtuZXdQcm9wczogbmV3UHJvcHMsIHVzZXI6IHJlcy5kYXRhLnVzZXJ9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4odXNlciA9PiBjb25zb2xlLmxvZyhcIm5ldyB1c2VyIGRhdGFcIiwgdXNlcikpXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUuZXJyb3IoXCJzb21ldGhpbmcgd2VudCB3cm9uZ1wiLCBlcnJvcikpO1xuICAgICAgICB9LFxuICAgICAgICBhcmNoaXZlVG9tc0VhdGVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIVN0b3JlLnByb2ZpbGUudG9tc1RvZGF5KSB7XG4gICAgICAgICAgICAgICAgJGxvZy5pbmZvKFwibm90aGluZyB0byBhcmNoaXZlLiBVc2VyIG5vdCB1cGRhdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCB0b21JbmZvID0ge1xuICAgICAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgdG90YWw6IFN0b3JlLnByb2ZpbGUudG9tc1RvZGF5LFxuICAgICAgICAgICAgICAgIHRvbWF0b01ldGVyOiBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi50b21hdG9NZXRlci5maWx0ZXIodCA9PiB0LnRleHQgIT09IFwiLi4uXCIpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFN0b3JlLnByb2ZpbGUudG9tc0VhdGVuLnRvbWF0b01ldGVyID0gW107XG4gICAgICAgICAgICBsZXQgbmV3QXJjaGl2ZSA9IFt0b21JbmZvXS5jb25jYXQoU3RvcmUucHJvZmlsZS50b21zRWF0ZW4uYXJjaGl2ZSk7XG4gICAgICAgICAgICByZXR1cm4gU3RvcmUudXBkYXRlUHJvZmlsZSh7dG9tc0VhdGVuOiB7YXJjaGl2ZTogbmV3QXJjaGl2ZX19KTtcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gYXR0YWNoIHVzZXIgdG8gdGhlIHN0b3JlXG5cbiAgICByZXR1cm4gU3RvcmU7XG5cbn0pO1xuXG4vKlxuIHVubG9ja0F0OlxuIE51bWJlciAtIGFtb3VudCBvZiB0b3RhbCB0b21zIGVhdGVuXG4gT2JqIC0gZGlmZmVyZW50IHByb3AgdG8gdW5sb2NrIGF0OlxuIHRvbXNDb21wbGV0ZSAoZGVmdWFsdCkgLSB0b3RhbCB0b21zIGVhdGVuLiBTYW1lIGFzIHBhc3NpbmcgbnVtYmVyXG4gdG9tc1RvZGF5IC0gbnVtYmVyIGluIGEgZGF5LlxuIGRheXNDb21wbGV0ZTogbnVtYmVyIG9mIGRheXMgYSB0b20gd2FzIGVhdGVuOiBPUiBvYmpcbiBzdHJlYWs6IG51bWJlciBkYXlzIGluIGEgcm93IHRoYXQgYSB0b20gd2FzIGVhdGVuLlxuXG4gRmVhdHVyZSBsaXN0ZW5lcnM6XG4gXCJ0b21Db21wbGV0ZVwiIDogd2hlbiBhIHBvbW9kb3JvIGlzIHN1Y2Vzc2Z1bGx5IGNvbXBsZXRlLlxuIFwibmV3RGF5XCIgOiB3aGVuIHRoZSBhcHAgaXMgb3BlbmVkIG9uIGEgbmV3IGRheS5cbiAqL1xuIiwiYXBwLmRpcmVjdGl2ZSgnZnVsbHN0YWNrTG9nbycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmh0bWwnXG4gICAgfTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSwgJHdpbmRvdykge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnUG9tb2Rvcm8nLCBzdGF0ZTogJ2hvbWUnIH0sXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ015IFN0dWZmJywgc3RhdGU6ICdtZScsIGF1dGg6IHRydWV9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdMZWFybicsIHN0YXRlOiAnbGVhcm4nfSxcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnQWJvdXQgLyBTdXBwb3J0Jywgc3RhdGU6ICdhYm91dCcgfSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBzY29wZS5zdGF0ZSA9ICRzdGF0ZTtcblxuICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHNjb3BlLmlzTG9nZ2VkSW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmxvZ291dCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHNldFVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciByZW1vdmVVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNldFVzZXIoKTtcblxuICAgICAgICAgICAgc2NvcGUuZ29CYWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICR3aW5kb3cuaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldFVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9nb3V0U3VjY2VzcywgcmVtb3ZlVXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgcmVtb3ZlVXNlcik7XG5cbiAgICAgICAgICAgIHZhciAkZHJvcGRvd24gPSAkKFwiLm5hdmJhci1uYXYtbW9iaWxlLWRyb3Bkb3duXCIpO1xuXG4gICAgICAgICAgICBzY29wZS50b2dnbGVNb2JpbGVEcm9wZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZigkc3RhdGUuY3VycmVudC5uYW1lID09PSAnbG9naW4nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgJGRyb3Bkb3duLnRvZ2dsZUNsYXNzKCdvcGVuZWQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgY2xvc2VEcm9wZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkZHJvcGRvd24ucmVtb3ZlQ2xhc3MoJ29wZW5lZCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGNsb3NlRHJvcGRvd24pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgJCgnI21haW4nKS5vbignY2xpY2snLCBjbG9zZURyb3Bkb3duKTtcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdyYW5kb0dyZWV0aW5nJywgZnVuY3Rpb24gKFJhbmRvbUdyZWV0aW5ncykge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9yYW5kby1ncmVldGluZy9yYW5kby1ncmVldGluZy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgICAgICAgICBzY29wZS5ncmVldGluZyA9IFJhbmRvbUdyZWV0aW5ncy5nZXRSYW5kb21HcmVldGluZygpO1xuICAgICAgICB9XG4gICAgfTtcblxufSk7IiwiYXBwLmRpcmVjdGl2ZSgnc3BsYXNoU2NyZWVuJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlOiAnPGRpdiBpZD1cInNwbGFzaC1zY3JlZW5cIj48ZGl2IGlkPVwibG9hZGluZy1jb250ZW50XCI+e3tsb2FkaW5nVGV4dH19PC9kaXY+PC9kaXY+JyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGUpIHtcblxuICAgICAgICAgICAgc2NvcGUubG9hZGluZ1RleHQgPSBcIkxvYWRpbmdcIjtcbiAgICAgICAgICAgIHZhciBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgYXBwZW5kID0gc2NvcGUubG9hZGluZ1RleHQgKyBcIiAuXCI7XG4gICAgICAgICAgICAgICAgaWYoYXBwZW5kLmxlbmd0aCA+IDE0KSBhcHBlbmQgPSBcIkxvYWRpbmdcIjtcbiAgICAgICAgICAgICAgICBzY29wZS5sb2FkaW5nVGV4dCA9IGFwcGVuZDtcbiAgICAgICAgICAgICAgICBzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgICAgICB9LCA0MDApO1xuXG4gICAgICAgICAgICB2YXIgc3BsYXNoVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYoIXdpbmRvdy5yZWFkeSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB3aW5kb3cucmVhZHk7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChzcGxhc2hUaW1lcik7XG4gICAgICAgICAgICAgICAgZWxlLnJlbW92ZSgpO1xuICAgICAgICAgICAgfSwyMDAwICsgKE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDUwMCkpKTtcblxuICAgICAgICB9XG4gICAgfVxufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
