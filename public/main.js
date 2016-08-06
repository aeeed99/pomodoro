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
        state.state = 'null';
        state.message = 'Marking failed...';
        document.title = "Pomodoro!";
        $scope.time = "0:00";
        setTimeout(function () {
            state.state = 'OFF';
            state.message = "Start a new pomodoro when ready.";
            $scope.$digest();
        }, 1000);
        if (!confirm("Mark pomodoro as failed?")) return;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFib3V0L2Fib3V0LmpzIiwiZG9jcy9kb2NzLmpzIiwiZnNhL2ZzYS1wcmUtYnVpbHQuanMiLCJob21lL2hvbWUuanMiLCJsZWFybi9sZWFybi5qcyIsImxvZ2luL2xvZ2luLmpzIiwibXktc3R1ZmYvbXktc3R1ZmYuanMiLCJjb21tb24vZmFjdG9yaWVzL0Z1bGxzdGFja1BpY3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1Byb2ZpbGVVcGRhdGVyLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1N0b3JlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZnVsbHN0YWNrLWxvZ28vZnVsbHN0YWNrLWxvZ28uanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvcmFuZG8tZ3JlZXRpbmcvcmFuZG8tZ3JlZXRpbmcuanMiLCJjb21tb24vZGlyZWN0aXZlcy9zcGxhc2gtc2NyZWVuL3NwbGFzaC1zY3JlZW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUEsYUFBQSxpQkFBQTs7QUFFQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsSUFBQSxNQUFBLENBQUEsVUFBQSxrQkFBQSxFQUFBLGlCQUFBLEVBQUE7QUFDQTtBQUNBLHNCQUFBLFNBQUEsQ0FBQSxJQUFBO0FBQ0E7QUFDQSx1QkFBQSxTQUFBLENBQUEsR0FBQTtBQUNBO0FBQ0EsdUJBQUEsSUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTtBQUNBLGVBQUEsUUFBQSxDQUFBLE1BQUE7QUFDQSxLQUZBO0FBR0EsQ0FUQTs7QUFXQTtBQUNBLElBQUEsR0FBQSxDQUFBLFVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQSxFQUFBOztBQUVBLFVBQUEsR0FBQSxDQUFBLGlCQUFBLEVBQUEsSUFBQSxDQUFBLGVBQUE7QUFDQSxlQUFBLFVBQUEsR0FBQSxJQUFBLE1BQUEsS0FBQSxHQUFBO0FBQ0EsZUFBQSxLQUFBLEdBQUEsSUFBQTtBQUNBLFlBQUEsT0FBQSxVQUFBLEVBQUE7QUFDQSxnQkFBQSxRQUFBLFNBQUEsS0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLEdBQUEsR0FBQSxLQUFBO0FBQ0Esb0JBQUEsSUFBQSxHQUFBLEtBQUE7QUFDQSxvQkFBQSxJQUFBLEdBQUEsS0FBQTtBQUNBLG9CQUFBLEtBQUEsR0FBQSxLQUFBO0FBQ0E7QUFDQSxLQVZBOztBQVlBO0FBQ0EsUUFBQSwrQkFBQSxTQUFBLDRCQUFBLENBQUEsS0FBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLElBQUEsSUFBQSxNQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0EsS0FGQTs7QUFJQTtBQUNBO0FBQ0EsZUFBQSxHQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsUUFBQSxFQUFBOztBQUVBLFlBQUEsQ0FBQSw2QkFBQSxPQUFBLENBQUEsRUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFlBQUEsWUFBQSxlQUFBLEVBQUEsRUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsY0FBQSxjQUFBOztBQUVBLG9CQUFBLGVBQUEsR0FBQSxJQUFBLENBQUEsVUFBQSxJQUFBLEVBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnQkFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQSxFQUFBLENBQUEsUUFBQSxJQUFBLEVBQUEsUUFBQTtBQUNBLGFBRkEsTUFFQTtBQUNBLHVCQUFBLEVBQUEsQ0FBQSxPQUFBO0FBQ0E7QUFDQSxTQVRBO0FBV0EsS0E1QkE7QUE4QkEsQ0FuREE7O0FDbEJBLElBQUEsTUFBQSxDQUFBLFVBQUEsY0FBQSxFQUFBOztBQUVBO0FBQ0EsbUJBQUEsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBLGFBQUEsUUFEQTtBQUVBLG9CQUFBLGlCQUZBO0FBR0EscUJBQUE7QUFIQSxLQUFBO0FBTUEsQ0FUQTs7QUFXQSxJQUFBLFVBQUEsQ0FBQSxpQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLGFBQUEsRUFBQTs7QUFFQTtBQUNBLFdBQUEsTUFBQSxHQUFBLEVBQUEsT0FBQSxDQUFBLGFBQUEsQ0FBQTtBQUVBLENBTEE7QUNYQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxhQUFBLE9BREE7QUFFQSxxQkFBQTtBQUZBLEtBQUE7QUFJQSxDQUxBOztBQ0FBLENBQUEsWUFBQTs7QUFFQTs7QUFFQTs7QUFDQSxRQUFBLENBQUEsT0FBQSxPQUFBLEVBQUEsTUFBQSxJQUFBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBOztBQUVBLFFBQUEsTUFBQSxRQUFBLE1BQUEsQ0FBQSxhQUFBLEVBQUEsRUFBQSxDQUFBOztBQUVBLFFBQUEsT0FBQSxDQUFBLFFBQUEsRUFBQSxZQUFBO0FBQ0EsWUFBQSxDQUFBLE9BQUEsRUFBQSxFQUFBLE1BQUEsSUFBQSxLQUFBLENBQUEsc0JBQUEsQ0FBQTtBQUNBLGVBQUEsT0FBQSxFQUFBLENBQUEsT0FBQSxRQUFBLENBQUEsTUFBQSxDQUFBO0FBQ0EsS0FIQTs7QUFLQTtBQUNBO0FBQ0E7QUFDQSxRQUFBLFFBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQSxzQkFBQSxvQkFEQTtBQUVBLHFCQUFBLG1CQUZBO0FBR0EsdUJBQUEscUJBSEE7QUFJQSx3QkFBQSxzQkFKQTtBQUtBLDBCQUFBLHdCQUxBO0FBTUEsdUJBQUE7QUFOQSxLQUFBOztBQVNBLFFBQUEsT0FBQSxDQUFBLGlCQUFBLEVBQUEsVUFBQSxVQUFBLEVBQUEsRUFBQSxFQUFBLFdBQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLGFBQUE7QUFDQSxpQkFBQSxZQUFBLGdCQURBO0FBRUEsaUJBQUEsWUFBQSxhQUZBO0FBR0EsaUJBQUEsWUFBQSxjQUhBO0FBSUEsaUJBQUEsWUFBQTtBQUpBLFNBQUE7QUFNQSxlQUFBO0FBQ0EsMkJBQUEsdUJBQUEsUUFBQSxFQUFBO0FBQ0EsMkJBQUEsVUFBQSxDQUFBLFdBQUEsU0FBQSxNQUFBLENBQUEsRUFBQSxRQUFBO0FBQ0EsdUJBQUEsR0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBO0FBQ0E7QUFKQSxTQUFBO0FBTUEsS0FiQTs7QUFlQSxRQUFBLE1BQUEsQ0FBQSxVQUFBLGFBQUEsRUFBQTtBQUNBLHNCQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsQ0FDQSxXQURBLEVBRUEsVUFBQSxTQUFBLEVBQUE7QUFDQSxtQkFBQSxVQUFBLEdBQUEsQ0FBQSxpQkFBQSxDQUFBO0FBQ0EsU0FKQSxDQUFBO0FBTUEsS0FQQTs7QUFTQSxRQUFBLE9BQUEsQ0FBQSxhQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUEsT0FBQSxFQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBLEtBQUEsRUFBQTs7QUFFQSxpQkFBQSxpQkFBQSxDQUFBLFFBQUEsRUFBQTs7QUFFQSxvQkFBQSxHQUFBLENBQUEsd0JBQUEsRUFBQSxRQUFBO0FBQ0Esa0JBQUEsTUFBQSxHQUFBLFFBQUE7QUFDQSxpQ0FBQSxRQUFBOztBQUVBLGdCQUFBLE9BQUEsTUFBQSxNQUFBLENBQUEsSUFBQTtBQUNBLG9CQUFBLEdBQUEsQ0FBQSxjQUFBLEVBQUEsSUFBQTtBQUNBLG9CQUFBLE1BQUEsQ0FBQSxLQUFBLEVBQUEsRUFBQSxLQUFBLElBQUE7QUFDQTtBQUNBO0FBQ0Esa0JBQUEsT0FBQSxHQUFBLEtBQUEsSUFBQTtBQUNBLGtCQUFBLElBQUEsR0FBQSxLQUFBLElBQUEsSUFBQSxLQUFBLElBQUEsQ0FBQSxFQUFBO0FBQ0EsdUJBQUEsU0FBQSxHQUFBLEtBQUE7QUFDQSx1QkFBQSxVQUFBLENBQUEsWUFBQSxZQUFBO0FBQ0EsbUJBQUEsS0FBQSxJQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGFBQUEsZUFBQSxHQUFBLFlBQUE7QUFDQSxtQkFBQSxDQUFBLENBQUEsUUFBQSxJQUFBO0FBQ0EsU0FGQTtBQUdBLGlCQUFBLG9CQUFBLENBQUEsY0FBQSxFQUFBO0FBQ0EsZ0JBQUEsZUFBQSxhQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUE7QUFDQSxnQkFBQSxZQUFBLEVBQUE7QUFDQSwrQkFBQSxLQUFBLEtBQUEsQ0FBQSxZQUFBLENBQUE7QUFDQTtBQUNBLHVCQUFBLE1BQUEsR0FBQSxDQUFBLHdCQUFBLEVBQUEsRUFBQSwwQkFBQSxFQUFBLEVBQ0EsSUFEQSxDQUNBLHVCQUFBO0FBQ0EsNEJBQUEsR0FBQSxDQUFBLHNCQUFBLEVBQUEsV0FBQTtBQUNBLCtCQUFBLFVBQUEsQ0FBQSxtQkFBQSxFQUFBLFlBQUEsSUFBQTtBQUNBLGlDQUFBLFVBQUEsQ0FBQSxTQUFBO0FBQ0EsMEJBQUEsTUFBQSxHQUFBLFdBQUE7QUFDQSwyQkFBQSxXQUFBO0FBQ0EsaUJBUEEsQ0FBQTtBQVFBLGFBWEEsTUFXQSxPQUFBLE1BQUEsTUFBQSxHQUFBLGNBQUE7QUFDQTs7QUFFQSxhQUFBLGVBQUEsR0FBQSxVQUFBLFVBQUEsRUFBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsZ0JBQUEsS0FBQSxlQUFBLE1BQUEsZUFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQSxHQUFBLElBQUEsQ0FBQSxRQUFBLElBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1CQUFBLE1BQUEsR0FBQSxDQUFBLFVBQUEsRUFBQSxFQUFBLFdBQUEsSUFBQSxJQUFBLEVBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQSxpQkFBQSxFQUFBLEtBQUEsQ0FBQSxZQUFBO0FBQ0EsdUJBQUEsSUFBQTtBQUNBLGFBRkEsQ0FBQTtBQUlBLFNBcEJBOztBQXNCQSxhQUFBLEtBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtBQUNBLG1CQUFBLE1BQUEsSUFBQSxDQUFBLFFBQUEsRUFBQSxXQUFBLEVBQ0EsSUFEQSxDQUNBLGlCQURBLEVBRUEsS0FGQSxDQUVBLFlBQUE7QUFDQSx1QkFBQSxHQUFBLE1BQUEsQ0FBQSxFQUFBLFNBQUEsNEJBQUEsRUFBQSxDQUFBO0FBQ0EsYUFKQSxDQUFBO0FBS0EsU0FOQTs7QUFRQSxhQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUEsTUFBQSxHQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0Esd0JBQUEsT0FBQTtBQUNBLDJCQUFBLFVBQUEsQ0FBQSxZQUFBLGFBQUE7QUFDQSxhQUhBLENBQUE7QUFJQSxTQUxBO0FBT0EsS0E5RUE7O0FBZ0ZBLFFBQUEsT0FBQSxDQUFBLFNBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUE7O0FBRUEsWUFBQSxPQUFBLElBQUE7O0FBRUEsbUJBQUEsR0FBQSxDQUFBLFlBQUEsZ0JBQUEsRUFBQSxZQUFBO0FBQ0EsaUJBQUEsT0FBQTtBQUNBLFNBRkE7O0FBSUEsbUJBQUEsR0FBQSxDQUFBLFlBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQSxpQkFBQSxPQUFBO0FBQ0EsU0FGQTs7QUFJQSxhQUFBLEVBQUEsR0FBQSxJQUFBO0FBQ0EsYUFBQSxJQUFBLEdBQUEsSUFBQTs7QUFFQSxhQUFBLE1BQUEsR0FBQSxVQUFBLFNBQUEsRUFBQSxJQUFBLEVBQUE7QUFDQSxpQkFBQSxFQUFBLEdBQUEsU0FBQTtBQUNBLGlCQUFBLElBQUEsR0FBQSxJQUFBO0FBQ0EsU0FIQTs7QUFLQSxhQUFBLE9BQUEsR0FBQSxZQUFBO0FBQ0EsaUJBQUEsRUFBQSxHQUFBLElBQUE7QUFDQSxpQkFBQSxJQUFBLEdBQUEsSUFBQTtBQUNBLFNBSEE7QUFLQSxLQXpCQTtBQTJCQSxDQTdKQTs7QUNBQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxhQUFBLEdBREE7QUFFQSxxQkFBQSxtQkFGQTtBQUdBLG9CQUFBLFVBSEE7QUFJQSxpQkFBQTtBQUNBLGtCQUFBLGNBQUEsV0FBQSxFQUFBLFVBQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSx1QkFBQSxZQUFBLGVBQUEsR0FDQSxJQURBLENBQ0EsZ0JBQUE7QUFDQSw0QkFBQSxHQUFBLENBQUEsaUJBQUEsRUFBQSxJQUFBO0FBQ0Esd0JBQUEsSUFBQSxFQUFBO0FBQ0EsOEJBQUEsSUFBQSxHQUFBLElBQUE7QUFDQSwrQkFBQSxJQUFBO0FBQ0E7QUFDQSw0QkFBQSxHQUFBLENBQUEsOEJBQUE7QUFDQSwrQkFBQSxTQUFBLEdBQUEsSUFBQTtBQUNBLHdCQUFBLGVBQUEsYUFBQSxPQUFBLENBQUEsU0FBQSxDQUFBO0FBQ0Esd0JBQUEsWUFBQSxFQUFBLE9BQUEsS0FBQSxLQUFBLENBQUEsWUFBQSxDQUFBO0FBQ0EsNEJBQUEsSUFBQSxDQUFBLGlDQUFBOztBQUVBLHdCQUFBLGtCQUFBO0FBQ0EsK0JBQUEsRUFEQTtBQUVBLG1DQUFBLENBRkE7QUFHQSxxQ0FBQSxFQUhBO0FBSUEsaUNBQUEsSUFKQTtBQUtBLGlDQUFBLEVBTEE7QUFNQSwwQ0FBQSxFQU5BO0FBT0Esc0NBQUEsS0FBQSxHQUFBLEVBUEE7QUFRQSw4QkFBQSxFQVJBO0FBU0EsK0JBQUE7QUFUQSxxQkFBQTtBQVdBLGlDQUFBLE9BQUEsQ0FBQSxTQUFBLEVBQUEsS0FBQSxTQUFBLENBQUEsZUFBQSxDQUFBO0FBQ0EsMkJBQUEsZUFBQTtBQUNBLGlCQTFCQSxDQUFBO0FBMkJBLGFBN0JBO0FBOEJBLHFCQUFBLG1CQUFBO0FBQ0EsdUJBQUEsRUFBQSxRQUFBLEdBQUEsRUFBQTtBQUNBO0FBaENBO0FBSkEsS0FBQTtBQXVDQSxDQXhDQTs7QUEwQ0EsSUFBQSxVQUFBLENBQUEsVUFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsSUFBQSxFQUFBLGNBQUEsRUFBQTtBQUNBLFlBQUEsR0FBQSxDQUFBLFlBQUEsRUFBQSxJQUFBO0FBQ0EsV0FBQSxVQUFBLEdBQUEsT0FBQSxVQUFBOztBQUVBLFFBQUEsUUFBQSxNQUFBLEtBQUEsR0FBQSxFQUFBO0FBQ0EsY0FBQSxnQkFBQTtBQUNBOztBQUVBLFdBQUEsZ0JBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQSxZQUFBLGVBQUEsR0FDQSxJQURBLENBQ0EsbUJBQUE7QUFDQSxtQkFBQSxPQUFBO0FBQ0EsbUJBQUEsT0FBQTtBQUNBLFNBSkEsQ0FBQTtBQUtBLEtBTkE7QUFPQSxXQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLE9BQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLEtBQUEsRUFBQTtBQUNBLG9CQUFBLEdBQUEsQ0FBQSx3QkFBQSxFQUFBLE9BQUE7QUFDQTtBQUNBO0FBQ0EsZ0JBQUEsSUFBQSxDQUFBLDBDQUFBLEVBQUEsT0FBQTtBQUNBLGVBQUEsT0FBQTtBQUNBLGVBQUEsV0FBQSxHQUFBLEtBQUEsV0FBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLE9BQUEsTUFBQSxFQUFBLE1BQUEsS0FBQSxFQUFBLENBQUE7QUFDQSxvQkFBQSxPQUFBLFdBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQTtBQUNBLG9CQUFBLEtBQUEsU0FBQSxJQUFBLENBQUE7QUFDQTtBQUNBO0FBQ0EsS0FaQTs7QUFjQTtBQUNBLFdBQUEsT0FBQSxHQUFBLEtBQUEsT0FBQTtBQUNBLFdBQUEsV0FBQSxHQUFBLEtBQUEsV0FBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLE9BQUEsTUFBQSxFQUFBLE1BQUEsS0FBQSxFQUFBLENBQUE7QUFDQSxRQUFBLFlBQUEsS0FBQSxTQUFBLElBQUEsQ0FBQTs7QUFFQTtBQUNBLFdBQUEsS0FBQSxHQUFBO0FBQ0EsZUFBQSxLQURBO0FBRUEsc0JBQUEsS0FGQTtBQUdBLHFCQUFBLEtBSEE7QUFJQSxpQkFBQSxLQUpBO0FBS0EsaUJBQUEsS0FMQTtBQU1BLGlCQUFBLEVBTkE7QUFPQSxzQkFBQSxJQVBBO0FBUUEsb0JBQUE7QUFSQSxLQUFBO0FBVUEsUUFBQSxRQUFBLE9BQUEsS0FBQSxDQTdDQSxDQTZDQTtBQUNBLFFBQUEsUUFBQSxFQUFBLFlBQUE7QUFBQSxtQkFBQSxJQUFBO0FBQUEsU0FBQSxFQUFBLENBOUNBLENBOENBO0FBQ0EsUUFBQSxtQkFBQTs7QUFFQSxRQUFBLFVBQUEsU0FBQSxPQUFBO0FBQUEsZUFBQSxPQUFBLElBQUEsSUFBQSxpQkFBQTtBQUFBLEtBQUE7O0FBRUEsV0FBQSxZQUFBLEdBQUE7QUFBQSxlQUFBLFNBQUE7QUFBQSxLQUFBO0FBQ0EsV0FBQSxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUEsTUFBQSxZQUFBLENBQUEsSUFBQSxDQUFBO0FBQ0EsS0FGQTs7QUFJQTs7O0FBR0EsV0FBQSxJQUFBLEdBQUEsTUFBQTtBQUNBO0FBQ0EsUUFBQSxZQUFBLE9BQUEsV0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLElBQUEsQ0FBQTs7QUFFQSxXQUFBLFlBQUEsR0FBQSxVQUFBLGFBQUEsRUFBQTtBQUNBLHlCQUFBLE1BQUEsVUFBQSxFQUFBO0FBRUEsS0FIQTs7QUFLQSxXQUFBLFVBQUEsR0FBQSxZQUFBO0FBQUEsWUFBQSxJQUFBLHlEQUFBLENBQUEsRUFBQSxFQUFBLENBQUEsQ0FBQTtBQUFBLFlBQUEsVUFBQTtBQUFBLFlBQUEsVUFBQTs7QUFDQSxxQkFBQSxjQUFBLFlBQUE7QUFDQTtBQUNBLGdCQUFBLE1BQUEsS0FBQSxLQUFBLFVBQUEsRUFBQSxTQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsZ0JBQUEsTUFBQSxLQUFBLEtBQUEsT0FBQSxJQUFBLE1BQUEsS0FBQSxLQUFBLFlBQUEsRUFBQSxTQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLFdBQUE7QUFDQSxtQkFBQSxPQUFBO0FBQ0EsU0FMQTtBQU1BLGdCQUFBLEdBQUEsQ0FBQSxjQUFBLEVBQUEsVUFBQTtBQUNBLGNBQUEsVUFBQTtBQUNBLGdCQUFBLElBQUEsS0FBQSxDQUFBLElBQUEsRUFBQSxVQUFBLEVBQUEsVUFBQSxDQUFBO0FBQ0EsWUFBQSxNQUFBLEtBQUEsS0FBQSxVQUFBLEVBQUEsU0FBQSxLQUFBLEdBQUEsT0FBQSxPQUFBLElBQUEsR0FBQSxPQUFBLElBQUEsTUFBQSxHQUFBLFNBQUE7QUFDQSxLQVhBOztBQWFBLFdBQUEsYUFBQSxHQUFBLFlBQUE7QUFDQSxjQUFBLEtBQUEsR0FBQSxNQUFBO0FBQ0EsbUJBQUE7QUFBQSxtQkFBQSxNQUFBLEtBQUEsR0FBQSxVQUFBO0FBQUEsU0FBQSxFQUFBLElBQUE7QUFDQSxjQUFBLFlBQUEsR0FBQSxJQUFBOztBQUVBLFlBQUEsWUFBQSxPQUFBLFdBQUEsQ0FBQSxTQUFBLENBQUE7QUFDQSxrQkFBQSxLQUFBLEdBQUEsUUFBQTtBQUNBLGtCQUFBLElBQUEsR0FBQSxZQUFBLENBQUE7O0FBRUEsWUFBQSxhQUFBLFNBQUEsVUFBQSxHQUFBO0FBQ0EsZ0JBQUEsU0FBQSxNQUFBLEVBQUEsSUFBQSxZQUFBLENBQUEsbUJBQUEsRUFBQTtBQUNBLHNCQUFBLCtDQURBO0FBRUEsc0JBQUE7QUFGQSxhQUFBO0FBSUEsbUJBQUEsYUFBQTtBQUNBLG1CQUFBLE9BQUE7QUFDQSxtQkFBQSxPQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLFNBUkE7QUFTQSxZQUFBLGFBQUEsU0FBQSxVQUFBLEdBQUE7QUFDQTtBQUNBLHFCQUFBLEtBQUEsR0FBQSxPQUFBLE9BQUEsSUFBQSxHQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsbUJBQUEsT0FBQTtBQUNBLFNBSkE7QUFLQSxjQUFBLE9BQUEsR0FBQSxhQUFBO0FBQ0EsaUJBQUEsS0FBQSxHQUFBLE9BQUEsT0FBQSxJQUFBLEdBQUEsT0FBQSxJQUFBLE1BQUEsR0FBQSxTQUFBO0FBQ0EsZUFBQSxVQUFBLENBQUEsQ0FBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUEsVUFBQSxFQUFBLFVBQUE7QUFDQSxLQTFCQTs7QUE0QkEsV0FBQSxVQUFBLEdBQUEsWUFBQTtBQUFBLFlBQUEsSUFBQSx5REFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUE7O0FBQ0EsY0FBQSxLQUFBLEdBQUEsTUFBQTtBQUNBLG1CQUFBO0FBQUEsbUJBQUEsTUFBQSxLQUFBLEdBQUEsT0FBQTtBQUFBLFNBQUEsRUFBQSxJQUFBO0FBQ0EsY0FBQSxhQUFBLEdBQUEsS0FBQTtBQUNBLGNBQUEsT0FBQSxHQUFBLElBQUE7QUFDQSxjQUFBLE9BQUEsR0FBQSx3R0FBQTtBQUNBLFlBQUEsYUFBQSxTQUFBLFVBQUEsR0FBQTtBQUNBLGdCQUFBLFNBQUEsTUFBQSxFQUFBLElBQUEsWUFBQSxDQUFBLGFBQUEsRUFBQTtBQUNBLHNCQUFBLCtDQURBO0FBRUEsc0JBQUE7QUFGQSxhQUFBO0FBSUEsbUJBQUEsU0FBQTtBQUNBLFNBTkE7QUFPQSxlQUFBLFVBQUEsQ0FBQSxJQUFBLEVBQUEsVUFBQTtBQUNBLEtBZEE7QUFlQSxXQUFBLFNBQUEsR0FBQSxZQUFBO0FBQUEsWUFBQSxJQUFBLHlEQUFBLENBQUEsQ0FBQSxFQUFBLEVBQUEsQ0FBQTs7QUFDQSxjQUFBLEtBQUEsR0FBQSxNQUFBO0FBQ0EsbUJBQUE7QUFBQSxtQkFBQSxNQUFBLEtBQUEsR0FBQSxZQUFBO0FBQUEsU0FBQSxFQUFBLElBQUE7QUFDQSxZQUFBLGVBQUEsU0FBQSxZQUFBLEdBQUE7QUFDQSxtQkFBQSxjQUFBLENBQUEsQ0FBQSxFQUFBLEVBQUEsRUFBQSxDQUFBLEVBQUEsSUFBQTtBQUNBLFNBRkE7QUFHQSxjQUFBLE9BQUEsR0FBQSx1REFBQTtBQUNBLGNBQUEsWUFBQSxHQUFBLEtBQUE7QUFDQSxnQkFBQSxJQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUEsWUFBQSxFQUFBLFlBQUE7QUFDQSxnQkFBQSxjQUFBLE1BQUEsT0FBQSxLQUFBLEdBQUEsR0FBQSxNQUFBLE9BQUEsRUFBQTtBQUNBLGtCQUFBLE9BQUEsR0FBQSx3RUFBQSxXQUFBO0FBQ0EsbUJBQUEsT0FBQTtBQUNBLFNBSkEsQ0FBQTtBQUtBLEtBYkE7QUFjQSxXQUFBLGNBQUEsR0FBQSxZQUFBO0FBQUEsWUFBQSxJQUFBLHlEQUFB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LGtCQUFBLENBQ0EsRUFBQSxNQUFBLFlBQUEsRUFBQSxVQUFBLENBQUEsRUFBQSxVQUFBLGFBQUEsRUFEQSxFQUVBLEVBQUEsTUFBQSxNQUFBLEVBQUEsVUFBQSxDQUFBLEVBQUEsVUFBQSxhQUFBLEVBRkEsRUFHQSxFQUFBLE1BQUEsVUFBQSxFQUFBLFVBQUEsRUFBQSxjQUFBLENBQUEsRUFBQSxFQUFBLFVBQUEsYUFBQSxFQUhBLEVBSUEsRUFBQSxNQUFBLE9BQUEsRUFBQSxVQUFBLENBQUEsRUFBQSxNQUFBLE1BQUEsRUFBQSxVQUFBLGFBQUEsRUFKQSxFQUtBLEVBQUEsTUFBQSxVQUFBLEVBQUEsVUFBQSxFQUFBLFdBQUEsQ0FBQSxFQUFBLEVBQUEsVUFBQSxhQUFBLEVBTEEsRUFNQSxFQUFBLE1BQUEsWUFBQSxFQUFBLFVBQUEsRUFBQSxRQUFBLENBQUEsRUFBQSxFQUFBLFVBQUEsYUFBQSxFQU5BLEVBT0EsRUFBQSxNQUFBLFFBQUEsRUFBQSxVQUFBLEVBQUEsRUFBQSxNQUFBLE1BQUEsRUFBQSxVQUFBLGFBQUEsRUFQQSxFQVFBO0FBQ0Esa0JBQUEsV0FEQTtBQUVBLHNCQUFBLEVBQUEsY0FBQSxFQUFBLEVBRkE7QUFHQSxzQkFBQTtBQUFBLHVCQUFBLElBQUEsSUFBQSxFQUFBLENBQUEsUUFBQSxLQUFBLEVBQUE7QUFBQSxhQUhBO0FBSUEsc0JBQUE7QUFKQSxTQVJBLEVBY0EsRUFBQSxNQUFBLGNBQUEsRUFBQSxVQUFBLElBQUEsRUFBQSxVQUFBLGFBQUEsRUFkQSxDQW5CQTtBQW1DQSxzQkFBQSxzQkFBQSxJQUFBLEVBQUE7QUFDQSxtQkFBQSxFQUFBLEdBQUEsQ0FBQSxLQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUE7QUFBQSx1QkFBQSxFQUFBLFdBQUEsQ0FBQSxNQUFBLENBQUE7QUFBQSwyQkFBQSxFQUFBLEtBQUEsS0FBQSxVQUFBO0FBQUEsaUJBQUEsRUFBQSxNQUFBO0FBQUEsYUFBQSxDQUFBLEtBQUEsS0FBQSxTQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0Esb0JBQUEsR0FBQSxDQUFB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O0FBR0EsY0FBQSxjQUFBLEtBQUEsRUFBQTtBQUNBLGtCQUFBLFFBQUEsR0FBQSxnQkFBQSxpQkFBQSxFQUFBO0FBQ0E7QUFMQSxLQUFBO0FBUUEsQ0FWQTtBQ0FBLElBQUEsU0FBQSxDQUFBLGNBQUEsRUFBQSxZQUFBO0FBQ0EsV0FBQTtBQUNBLGtCQUFBLEdBREE7QUFFQSxrQkFBQSwrRUFGQTtBQUdBLGNBQUEsY0FBQSxLQUFBLEVBQUEsR0FBQSxFQUFBOztBQUVBLGtCQUFBLFdBQUEsR0FBQSxTQUFBO0FBQ0EsZ0JBQUEsV0FBQSxZQUFBLFlBQUE7QUFDQSxvQkFBQSxTQUFBLE1BQUEsV0FBQSxHQUFBLElBQUE7QUFDQSxvQkFBQSxPQUFBLE1BQUEsR0FBQSxFQUFBLEVBQUEsU0FBQSxTQUFBO0FBQ0Esc0JBQUEsV0FBQSxHQUFBLE1BQUE7QUFDQSxzQkFBQSxPQUFBO0FBQ0EsYUFMQSxFQUtBLEdBTEEsQ0FBQTs7QUFPQSxnQkFBQSxjQUFBLFlBQUEsWUFBQTtBQUNBLG9CQUFBLENBQUEsT0FBQSxLQUFBLEVBQUE7QUFDQTtBQUNBLDhCQUFBLFFBQUE7QUFDQSw4QkFBQSxXQUFBO0FBQ0Esb0JBQUEsTUFBQTtBQUNBLGFBTkEsRUFNQSxPQUFBLEtBQUEsS0FBQSxDQUFBLEtBQUEsTUFBQSxLQUFBLEdBQUEsQ0FOQSxDQUFBO0FBUUE7QUFyQkEsS0FBQTtBQXVCQSxDQXhCQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG5Ob3RpZmljYXRpb24ucmVxdWVzdFBlcm1pc3Npb24oKTtcblxud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdGdWxsc3RhY2tHZW5lcmF0ZWRBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJ10pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvJyk7XG4gICAgLy8gVHJpZ2dlciBwYWdlIHJlZnJlc2ggd2hlbiBhY2Nlc3NpbmcgYW4gT0F1dGggcm91dGVcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfSk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgJGh0dHApIHtcblxuICAgICRodHRwLmdldCgnL2FwaS9wcm9kdWN0aW9uJykudGhlbihyZXMgPT4ge1xuICAgICAgICB3aW5kb3cucHJvZHVjdGlvbiA9IHJlcy5zdGF0dXMgPT09IDIwMTtcbiAgICAgICAgd2luZG93LnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgaWYod2luZG93LnByb2R1Y3Rpb24pIHtcbiAgICAgICAgICAgIHZhciBuaWxGbiA9IGZ1bmN0aW9uKCkge307XG4gICAgICAgICAgICBjb25zb2xlLmxvZyA9IG5pbEZuO1xuICAgICAgICAgICAgY29uc29sZS5pbmZvID0gbmlsRm47XG4gICAgICAgICAgICBjb25zb2xlLndhcm4gPSBuaWxGbjtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IgPSBuaWxGbjtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgLy8gUmVnaXN0ZXIgb3VyICphYm91dCogc3RhdGUuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2Fib3V0Jywge1xuICAgICAgICB1cmw6ICcvYWJvdXQnLFxuICAgICAgICBjb250cm9sbGVyOiAnQWJvdXRDb250cm9sbGVyJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9hYm91dC9hYm91dC5odG1sJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0Fib3V0Q29udHJvbGxlcicsIGZ1bmN0aW9uICgkc2NvcGUsIEZ1bGxzdGFja1BpY3MpIHtcblxuICAgIC8vIEltYWdlcyBvZiBiZWF1dGlmdWwgRnVsbHN0YWNrIHBlb3BsZS5cbiAgICAkc2NvcGUuaW1hZ2VzID0gXy5zaHVmZmxlKEZ1bGxzdGFja1BpY3MpO1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdkb2NzJywge1xuICAgICAgICB1cmw6ICcvZG9jcycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvZG9jcy9kb2NzLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTLCBTdG9yZSkge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEsIFN0b3JlKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJvbiBzdWNycnJycmVzc3MgcmVzIDogXCIsIHJlc3BvbnNlKVxuICAgICAgICAgICAgU3RvcmUubmV3UmVzID0gcmVzcG9uc2U7XG4gICAgICAgICAgICBjaGVja0ZvckxvY2FsU3RvcmFnZShyZXNwb25zZSlcblxuICAgICAgICAgICAgdmFyIGRhdGEgPSBTdG9yZS5uZXdSZXMuZGF0YTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibmV3IGRhaHRhYWEgXCIsIGRhdGEpO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUoZGF0YS5pZCwgZGF0YS51c2VyKTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgcHJvZmlsZSB0byB0aGUgc3RvcmUgZmFjdG9yeSwgd2hpY2ggd2lsbCBjb250aW51ZSB0byB1cGRhdGUgdGhlIHVzZXIgZGF0YVxuICAgICAgICAgICAgLy8gU3RvcmUucHJvZmlsZSA9IGRhdGEudXNlci5wcm9maWxlO1xuICAgICAgICAgICAgU3RvcmUucHJvZmlsZSA9IGRhdGEudXNlcjtcbiAgICAgICAgICAgIFN0b3JlLnVzZXIgPSBkYXRhLnVzZXIgJiYgZGF0YS51c2VyLmlkO1xuICAgICAgICAgICAgJHJvb3RTY29wZS5ndWVzdE1vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEudXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcbiAgICAgICAgZnVuY3Rpb24gY2hlY2tGb3JMb2NhbFN0b3JhZ2UocmVzcG9uc2VUb1Bhc3MpIHtcbiAgICAgICAgICAgIHZhciBsb2NhbFByb2ZpbGUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgncHJvZmlsZScpO1xuICAgICAgICAgICAgaWYobG9jYWxQcm9maWxlKXtcbiAgICAgICAgICAgICAgICBsb2NhbFByb2ZpbGUgPSBKU09OLnBhcnNlKGxvY2FsUHJvZmlsZSk7XG4gICAgICAgICAgICAgICAgLy8gbWVyZ2UgbG9jYWwgcHJvZmlsZVxuICAgICAgICAgICAgICAgIHJldHVybiAkaHR0cC5wdXQoJy9hcGkvdXNlci9sb2NhbFByb2ZpbGUnLCB7bG9jYWxQcm9maWxlfSApXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKG5ld1Jlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVEhFIE5FVyBSRVNPUE9TRUVFRUVcIiwgbmV3UmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIG5ld1Jlc3BvbnNlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgncHJvZmlsZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmUubmV3UmVzID0gbmV3UmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3UmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHJldHVybiAoU3RvcmUubmV3UmVzID0gcmVzcG9uc2VUb1Bhc3MpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJywge2xvZ2luVGltZTogbmV3IERhdGUoKX0pLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3Qoe21lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLid9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gc2Vzc2lvbklkO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSkoKTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2hvbWUnLCB7XG4gICAgICAgIHVybDogJy8nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2hvbWUvaG9tZS5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0hvbWVDdHJsJyxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgdXNlcjogZnVuY3Rpb24gKEF1dGhTZXJ2aWNlLCAkcm9vdFNjb3BlLCBTdG9yZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgICAgICAgICAudGhlbih1c2VyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVVNFUiBTVEFUVVNTU1MgXCIsIHVzZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdG9yZS51c2VyID0gdXNlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdXNlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibm8gdXNlciwgZG9pbmcgbG9jYWwgcHJvZmlsZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICRyb290U2NvcGUuZ3Vlc3RNb2RlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsb2NhbFByb2ZpbGUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcInByb2ZpbGVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxQcm9maWxlKSByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFByb2ZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKFwibm8gbG9jYWwgcHJvZmlsZSwgY3JlYXRpbmcgb25lIVwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0xvY2FsUHJvZmlsZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b21zVG9kYXk6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9tYXRvTWV0ZXI6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bkRpYWw6IFNkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJjaGl2ZTogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5sb2NrZWRGZWF0dXJlczogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExvZ2dlZEluOiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3Vlc3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJwcm9maWxlXCIsIEpTT04uc3RyaW5naWZ5KG5ld0xvY2FsUHJvZmlsZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld0xvY2FsUHJvZmlsZTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9maWxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3RhdHVzOiAxMDAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdIb21lQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIFN0b3JlLCBwcm9maWxlLCB1c2VyLCBQcm9maWxlVXBkYXRlcikge1xuICAgIGNvbnNvbGUubG9nKFwidGhlIHVzZXI6IFwiLCB1c2VyKTtcbiAgICAkc2NvcGUucHJvZHVjdGlvbiA9IHdpbmRvdy5wcm9kdWN0aW9uO1xuXG4gICAgaWYgKHByb2ZpbGUuc3RhdHVzID09PSAyMDIpIHtcbiAgICAgICAgU3RvcmUuYXJjaGl2ZVRvbXNFYXRlbigpO1xuICAgIH1cblxuICAgICRzY29wZS51cGRhdGVDb250cm9sbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgICAgIC50aGVuKG5ld1VzZXIgPT4ge1xuICAgICAgICAgICAgICAgIHVzZXIgPSBuZXdVc2VyO1xuICAgICAgICAgICAgICAgICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgICAgICB9KVxuICAgIH07XG4gICAgJHNjb3BlLiRvbigndXBkYXRlLWNvbnRyb2xsZXInLCBmdW5jdGlvbiAoZXZlbnQsIG5ld1VzZXIsIGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJhbiBlcnJvciBoYXBwZW5lZCEhISEhXCIsIG5ld1VzZXIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUuaW5mbyhcIltIb21lQ3RybF0gYHVwZGF0ZS1jb250cm9sbGVyYCB0cmlnZ2VyZWRcIiwgbmV3VXNlcik7XG4gICAgICAgIHVzZXIgPSBuZXdVc2VyO1xuICAgICAgICAkc2NvcGUudG9tYXRvTWV0ZXIgPSB1c2VyLnRvbWF0b01ldGVyLmNvbmNhdCh7Y2xhc3M6ICd3YWl0JywgdGV4dDogXCIuLi5cIn0pO1xuICAgICAgICBhY3RpdmVJZHggPSAkc2NvcGUudG9tYXRvTWV0ZXIubGVuZ3RoIC0gMTtcbiAgICAgICAgY29tcGxldGVkID0gdXNlci50b21zVG9kYXkgfHwgMDtcbiAgICAgICAgLy8gJHNjb3BlLiRkaWdlc3QoKTtcbiAgICAgICAgLy8gJHNjb3BlLnVwZGF0ZUNvbnRyb2xsZXIoKTtcbiAgICB9KTtcblxuICAgIC8vIGFzc2lnbiBjdXJyZW50IHN0YXRzIHRvIHBpY2sgdXAgd2hlcmUgd2UgbGVmdCBvZmYuXG4gICAgJHNjb3BlLmlzR3Vlc3QgPSB1c2VyLmlzR3Vlc3Q7XG4gICAgJHNjb3BlLnRvbWF0b01ldGVyID0gdXNlci50b21hdG9NZXRlci5jb25jYXQoe2NsYXNzOiAnd2FpdCcsIHRleHQ6IFwiLi4uXCJ9KTtcbiAgICBsZXQgY29tcGxldGVkID0gdXNlci50b21zVG9kYXkgfHwgMDtcblxuICAgIC8vIHN0dWZmIHRoYXQgaGFzIGEgbGlmZWN5Y2xlXG4gICAgJHNjb3BlLnN0YXRlID0ge1xuICAgICAgICBzdGF0ZTogXCJPRkZcIixcbiAgICAgICAgdGltZXJSdW5uaW5nOiBmYWxzZSxcbiAgICAgICAgdGltZXJQYXVzZWQ6IGZhbHNlLFxuICAgICAgICBvbkJyZWFrOiBmYWxzZSxcbiAgICAgICAgZWRpdGluZzogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IFwiXCIsXG4gICAgICAgIHN0YW5kYnlUaW1lcjogbnVsbCxcbiAgICAgICAgYnJlYWtUaW1lcjogbnVsbCxcbiAgICB9O1xuICAgIGxldCBzdGF0ZSA9ICRzY29wZS5zdGF0ZTsgLy8gZm9yIGJldHRlciByZWFkYWJpbGl0eS5cbiAgICB2YXIgdGltZXIgPSB7Y2xlYXJUaW1lcjogKCkgPT4gbnVsbH07IC8vIHRvIHByZXZlbnQgaW52b2tpbmcgdGhlIGZ1bmN0aW9uIG9uIGFuIHVuZGVmaW5lZCBvbiBmaXJzdCBjYWxsO1xuICAgIGxldCB0aXRsZUNhY2hlO1xuXG4gICAgbGV0IGdldEdvYWwgPSAoKSA9PiAkc2NvcGUuZ29hbCB8fCBcImVhdGluZyBhIHRvbWF0b1wiO1xuXG4gICAgJHNjb3BlLmdldENvbXBsZXRlZCA9ICgpID0+IGNvbXBsZXRlZDtcbiAgICAkc2NvcGUuZ2V0VG90YWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBTdG9yZS5nZXRUb3RhbFRvbXModXNlcik7XG4gICAgfVxuXG4gICAgLy8gJHNjb3BlLmdvYWwgPSBcIlwiO1xuXG5cbiAgICAkc2NvcGUudGltZSA9IFwiMDowMFwiO1xuICAgIC8vICRzY29wZS5zdGF0ZS5vbkJyZWFrID0gKCkgPT4gJHNjb3BlLnN0YXRlLm9uQnJlYWs7XG4gICAgbGV0IGFjdGl2ZUlkeCA9ICgkc2NvcGUudG9tYXRvTWV0ZXIubGVuZ3RoIC0gMSkgfHwgMDtcblxuICAgICRzY29wZS5zdGFydEluaXRpYWwgPSBmdW5jdGlvbiAoZG9udFN0b3BUaW1lcikge1xuICAgICAgICBkb250U3RvcFRpbWVyIHx8IHRpbWVyLmNsZWFyVGltZXIoKTtcblxuICAgIH1cblxuICAgICRzY29wZS5zdGFydFRpbWVyID0gZnVuY3Rpb24gKHRpbWUgPSBbMjUsIDBdLCBjb21wbGV0ZUZuLCBpbnRlcnZhbEZuKSB7XG4gICAgICAgIGludGVydmFsRm4gPSBpbnRlcnZhbEZuIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyBhc3NpZ24gc2NvcGUgYW5kIGRvY3VtZW50IHRpdGxlIGluIG9uZSBnb1xuICAgICAgICAgICAgICAgIGlmKHN0YXRlLnN0YXRlID09PSBcIlBPTU9CT1JPXCIpIGRvY3VtZW50LnRpdGxlID0gXCJbXCIgKyAoJHNjb3BlLnRpbWUgPSB0aW1lci5nZXRNaW5zKCkgKyBcIjpcIiArIHRpbWVyLmdldFNlY3MoKSkgKyBcIl0gwqsgXCIgKyBnZXRHb2FsKCk7XG4gICAgICAgICAgICAgICAgaWYoc3RhdGUuc3RhdGUgPT09IFwiQlJFQUtcIiB8fCBzdGF0ZS5zdGF0ZSA9PT0gXCJMT05HX0JSRUFLXCIpIGRvY3VtZW50LnRpdGxlID0gXCJbXCIgKyAoJHNjb3BlLnRpbWUgPSB0aW1lci5nZXRNaW5zKCkgKyBcIjpcIiArIHRpbWVyLmdldFNlY3MoKSkgKyBcIl0gwqsgQlJFQUtcIjtcbiAgICAgICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgY29uc29sZS5sb2coXCJJTlRFUlZBTCBGTiBcIiwgIGludGVydmFsRm4pO1xuICAgICAgICB0aW1lci5jbGVhclRpbWVyKClcbiAgICAgICAgdGltZXIgPSBuZXcgVGltZXIodGltZSwgY29tcGxldGVGbiwgaW50ZXJ2YWxGbik7XG4gICAgICAgIGlmKHN0YXRlLnN0YXRlID09PSBcIlBPTU9ET1JPXCIpIGRvY3VtZW50LnRpdGxlID0gXCJbXCIgKyAoJHNjb3BlLnRpbWUgPSBcIjI1OjAwXCIpICsgXCJdIMKrIFwiICsgZ2V0R29hbCgpO1xuICAgIH07XG5cbiAgICAkc2NvcGUuc3RhcnRQb21vZG9ybyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3RhdGUuc3RhdGUgPSBcIm51bGxcIjtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBzdGF0ZS5zdGF0ZSA9ICdQT01PRE9STycsIDEwMDApO1xuICAgICAgICBzdGF0ZS50aW1lclJ1bm5pbmcgPSB0cnVlO1xuXG4gICAgICAgIGxldCBhY3RpdmVUb20gPSAkc2NvcGUudG9tYXRvTWV0ZXJbYWN0aXZlSWR4XTtcbiAgICAgICAgYWN0aXZlVG9tLmNsYXNzID0gJ2FjdGl2ZSc7XG4gICAgICAgIGFjdGl2ZVRvbS50ZXh0ID0gY29tcGxldGVkICsgMTtcblxuICAgICAgICBsZXQgY29tcGxldGVGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIG5ldyBOb3RpZmljYXRpb24oXCJQb21vZG9ybyBjb21wbGV0ZVwiLCB7XG4gICAgICAgICAgICAgICAgYm9keTogXCJUYWtlIGEgNSBtaW51dGUgYnJlYWsgb3Igc2VsZWN0IG90aGVyIG9wdGlvbnNcIixcbiAgICAgICAgICAgICAgICBpY29uOiBcIi9wdWJsaWMvdG9tYXRvLnBuZ1wiXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICRzY29wZS5fbWFya0NvbXBsZXRlKCk7XG4gICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICAgICAgcmV0dXJuICRzY29wZS5zdGFydEJyZWFrKFs1LDBdKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGludGVydmFsRm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBhc3NpZ24gc2NvcGUgYW5kIGRvY3VtZW50IHRpdGxlIGluIG9uZSBnb1xuICAgICAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIltcIiArICgkc2NvcGUudGltZSA9IHRpbWVyLmdldE1pbnMoKSArIFwiOlwiICsgdGltZXIuZ2V0U2VjcygpKSArIFwiXSDCqyBcIiArIGdldEdvYWwoKTtcbiAgICAgICAgICAgICRzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgIH07XG4gICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBcIkZvY3VzIHRpbWUhXCI7XG4gICAgICAgIGRvY3VtZW50LnRpdGxlID0gXCJbXCIgKyAoJHNjb3BlLnRpbWUgPSBcIjI1OjAwXCIpICsgXCJdIMKrIFwiICsgZ2V0R29hbCgpO1xuICAgICAgICAkc2NvcGUuc3RhcnRUaW1lcihbMjUsMF0sIGNvbXBsZXRlRm4sIGludGVydmFsRm4pXG4gICAgfTtcblxuICAgICRzY29wZS5zdGFydEJyZWFrID0gZnVuY3Rpb24gKHRpbWUgPSBbNSwwXSkge1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9ICdudWxsJztcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBzdGF0ZS5zdGF0ZSA9ICdCUkVBSycsIDEwMDApO1xuICAgICAgICBzdGF0ZS50aW1tZXJSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHN0YXRlLm9uQnJlYWsgPSB0cnVlO1xuICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJZb3UncmUgb24gYSBicmVhayEgWW91IGNhbiB0dXJuIHRoaXMgaW50byBhIGxvbmcgYnJlYWsgb3Igc3RhcnQgYSBuZXcgUG9tb2Rvcm8gd2l0aCB0aGUgYnV0dG9ucyBiZWxvdy5cIjtcbiAgICAgICAgbGV0IGNvbXBsZXRlRm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuaGlkZGVuKSBuZXcgTm90aWZpY2F0aW9uKFwiQnJlYWsgb3ZlciFcIiwge1xuICAgICAgICAgICAgICAgIGJvZHk6IFwiU3RhcnQgYW5vdGhlciBwb21vZG9ybywgb3IgdGFrZSBhIGxvbmcgYnJlYWsuXCIsXG4gICAgICAgICAgICAgICAgaWNvbjogXCIvcHVibGljL3RvbWF0by5wbmdcIlxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAkc2NvcGUucG9zdEJyZWFrKCk7XG4gICAgICAgIH07XG4gICAgICAgICRzY29wZS5zdGFydFRpbWVyKHRpbWUsIGNvbXBsZXRlRm4pO1xuICAgIH07XG4gICAgJHNjb3BlLnBvc3RCcmVhayA9IGZ1bmN0aW9uICh0aW1lID0gWzEsIDMwXSkge1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9ICdudWxsJztcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBzdGF0ZS5zdGF0ZSA9IFwiUE9TVF9CUkVBS1wiLDEwMDApO1xuICAgICAgICBsZXQgZm9yY2VCcmVha0ZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLnN0YXJ0TG9uZ0JyZWFrKFsxMywzMF0sIHRydWUpO1xuICAgICAgICB9O1xuICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJTZWxlY3Qgd2hhdCB0byBkbyBuZXh0LiBXZSB3aWxsIHN0YXJ0IGEgYnJlYWsgaW4gMTozMFwiO1xuICAgICAgICBzdGF0ZS50aW1lclJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGltZXIgPSBuZXcgVGltZXIodGltZSxmb3JjZUJyZWFrRm4sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzdGFuZGJ5VGltZSA9IHRpbWVyLmdldE1pbnMoKSArIFwiOlwiICsgdGltZXIuZ2V0U2VjcygpO1xuICAgICAgICAgICAgc3RhdGUubWVzc2FnZSA9IFwiU2VsZWN0IHdoYXQgdG8gZG8gbmV4dC4gVGhpcyBhdXRvbWF0aWNhbGx5IGJlY29tZXMgYSBsb25nIGJyZWFrIGluIFwiICsgc3RhbmRieVRpbWU7XG4gICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgICRzY29wZS5zdGFydExvbmdCcmVhayA9IGZ1bmN0aW9uICh0aW1lID0gWzE1LCAwXSwgZm9yY2VkKSB7XG4gICAgICAgIHN0YXRlLnN0YXRlID0gXCJMT05HX0JSRUFLXCI7XG4gICAgICAgICRzY29wZS5fbWFya0xvbmdCcmVha1N0YXJ0KCk7XG4gICAgICAgIHN0YXRlLm1lc3NhZ2UgPSBmb3JjZWQgPyBcIllvdSd2ZSBiZWVuIGlkbGUgZm9yIGEgd2hpbGUuIFNvIHdlJ3ZlIG1hZGUgdGhpcyBhIGxvbmcgYnJlYWtcIlxuICAgICAgICAgICAgOiBcIlJlbGF4IGZvciBhIHdoaWxlLCBvciBzdGFydCBhbm90aGVyIFBvbW9kb3JvIGlmIHlvdSdyZSByZWFkeS5cIjtcbiAgICAgICAgJHNjb3BlLnN0YXJ0VGltZXIodGltZSAsZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICRzY29wZS5fbWFya0xvbmdCcmVha0NvbXBsZXRlKCk7XG4gICAgICAgICAgICAkc2NvcGUucG9zdEJyZWFrKClcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgICRzY29wZS5zdG9wQ3VycmVudFRpbWVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aW1lci5jbGVhckludGVydmFsKCk7XG4gICAgfTtcblxuXG5cbiAgICAkc2NvcGUudG9nZ2xlUGF1c2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGltZXIpICByZXR1cm47XG5cbiAgICAgICAgdGltZXIudG9nZ2xlUGF1c2UoKTtcbiAgICAgICAgc3RhdGUudGltZXJQYXVzZWQgPSAhc3RhdGUudGltZXJQYXVzZWQ7XG4gICAgICAgIGlmICghdGl0bGVDYWNoZSkge1xuICAgICAgICAgICAgdGl0bGVDYWNoZSA9IGRvY3VtZW50LnRpdGxlO1xuICAgICAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIuKWkOKWkCBcIiArIGRvY3VtZW50LnRpdGxlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZG9jdW1lbnQudGl0bGUgPSB0aXRsZUNhY2hlO1xuICAgICAgICAgICAgdGl0bGVDYWNoZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIH07XG5cblxuICAgIC8vLy8gSU5URVJOQUwgTE9HSUMgLy8vXG4gICAgLy8gVE9ETyB0aGlzIHN0dWZmIHNob3VsZCBiZSBtb3ZlZCBvZmYgdGhlIHNjb3BlIGFuZCBwdXQgaW50byBhcHJvcHJpYXRlIHRpbWVvdXRzLlxuXG4gICAgJHNjb3BlLl9tYXJrQ29tcGxldGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBhY3RpdmVUb20gPSAkc2NvcGUudG9tYXRvTWV0ZXJbYWN0aXZlSWR4XTtcbiAgICAgICAgLy8gbWFyayB0aGUgcGVuZGluZyB0b20gY29tcGxldGVcbiAgICAgICAgYWN0aXZlVG9tLnRleHQgPSBjb21wbGV0ZWQgKyAxOyAvL2ZvciBodW1hbiByZWFkYmxlIDEtaW5kZXhpbmdcbiAgICAgICAgYWN0aXZlVG9tLmNsYXNzID0gJ2NvbXBsZXRlJztcblxuICAgICAgICBjb21wbGV0ZWQrKztcbiAgICAgICAgYWN0aXZlSWR4Kys7XG4gICAgICAgIC8vICRzY29wZS50b21hdG9NZXRlci5wdXNoKHtjbGFzczogJ3dhaXQnLCB0ZXh0OiAnLi4uJ30pXG5cbiAgICAgICAgUHJvZmlsZVVwZGF0ZXIucHVzaFRvbWF0b01ldGVyKGFjdGl2ZVRvbSk7XG4gICAgICAgIC8vIC50aGVuKHJlcyA9PiBjb25zb2xlLmluZm8oXCJbaG9tZS5qczptYXJrQ29wbGV0ZV0gdXNlciBwcm9maWxlIHVwZGF0ZWRcIiwgcmVzKSk7XG4gICAgICAgIC8vIFN0b3JlLnByb2ZpbGUudG9tc0VhdGVuLnRvZGF5Kys7XG4gICAgfTtcblxuICAgICRzY29wZS5fbWFya0xvbmdCcmVha1N0YXJ0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZVRvbS50ZXh0ID0gXCIjYnJlYWsjXCI7XG4gICAgICAgIGFjdGl2ZVRvbS5jbGFzcyA9ICdicmVhayc7XG4gICAgICAgICRzY29wZS5zdGF0ZS5vbkJyZWFrID0gdHJ1ZTtcbiAgICB9O1xuICAgICRzY29wZS5fbWFya0xvbmdCcmVha0NvbXBsZXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBkb2N1bWVudC50aXRsZSA9IFwiUG9tb2Rvcm8hXCI7XG4gICAgICAgICRzY29wZS50aW1lID0gXCI6KFwiO1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZUlkeCsrO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSBcImJyZWFrIGNvbXBsZXRlXCI7XG4gICAgICAgIFByb2ZpbGVVcGRhdGVyLnB1c2hUb21hdG9NZXRlcihhY3RpdmVUb20pO1xuICAgIH07XG4gICAgJHNjb3BlLl9tYXJrRmFpbGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzdGF0ZS5zdGF0ZSA9ICdudWxsJztcbiAgICAgICAgc3RhdGUubWVzc2FnZSA9ICdNYXJraW5nIGZhaWxlZC4uLidcbiAgICAgICAgZG9jdW1lbnQudGl0bGUgPSBcIlBvbW9kb3JvIVwiO1xuICAgICAgICAkc2NvcGUudGltZSA9IFwiMDowMFwiO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHN0YXRlLnN0YXRlID0gJ09GRic7XG4gICAgICAgICAgICBzdGF0ZS5tZXNzYWdlID0gXCJTdGFydCBhIG5ldyBwb21vZG9ybyB3aGVuIHJlYWR5LlwiXG4gICAgICAgICAgICAkc2NvcGUuJGRpZ2VzdCgpO1xuICAgICAgICB9LDEwMDApO1xuICAgICAgICBpZighY29uZmlybShcIk1hcmsgcG9tb2Rvcm8gYXMgZmFpbGVkP1wiKSkgcmV0dXJuO1xuICAgICAgICBsZXQgYWN0aXZlVG9tID0gJHNjb3BlLnRvbWF0b01ldGVyW2FjdGl2ZUlkeF07XG4gICAgICAgIGFjdGl2ZUlkeCsrO1xuICAgICAgICBhY3RpdmVUb20uY2xhc3MgPSAnZmFpbCc7XG4gICAgICAgIGFjdGl2ZVRvbS50ZXh0ID0gJ1gnO1xuICAgICAgICBQcm9maWxlVXBkYXRlci5wdXNoVG9tYXRvTWV0ZXIoYWN0aXZlVG9tKTtcbiAgICAgICAgdGltZXIuY2xlYXJUaW1lcigpO1xuICAgIH07XG5cbiAgICAkc2NvcGUuZGVsZXRlVG9tYXRvTWV0ZXIgPSBQcm9maWxlVXBkYXRlci5kZWxldGVUb21hdG9NZXRlcjtcbiAgICAkc2NvcGUuYXJjaGl2ZVRvbWF0b01ldGVyID0gUHJvZmlsZVVwZGF0ZXIuYXJjaGl2ZVRvbWF0b01ldGVyO1xuXG5cbiAgICBsZXQgJGlucHV0R29hbCA9ICQoJ2lucHV0LmdvYWwnKSxcbiAgICAgICAgJHBsYWNlaG9sZGVyID0gJCgnI3BsYWNlaG9sZGVyJyksXG4gICAgICAgICRnb2FsSW5wdXQgPSAkKCcjZ29hbElucHV0Jyk7XG5cbiAgICAkc2NvcGUudG9nZ2xlRWRpdCA9ICgpID0+IHtcbiAgICAgICAgJHBsYWNlaG9sZGVyLmhpZGUoKTtcbiAgICAgICAgJGdvYWxJbnB1dC5zaG93KCk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dvYWxJbnB1dCcpLmZvY3VzKCksIDApO1xuICAgIH07XG4gICAgJGdvYWxJbnB1dC5ibHVyKCgpID0+IHtcbiAgICAgICAgaWYgKCEkc2NvcGUuZ29hbCkge1xuICAgICAgICAgICAgJGdvYWxJbnB1dC5oaWRlKCk7XG4gICAgICAgICAgICAkcGxhY2Vob2xkZXIuc2hvdygpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgJGdvYWxJbnB1dC5rZXlwcmVzcyhlID0+IHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZmluaXNoIGVkaXRcIik7XG4gICAgICAgICAgICAkaW5wdXRHb2FsLmJsdXIoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIC8vdG9tYXRvIGJ1dHRvbiBjb250cm9sc1xuICAgIHNldFRpbWVvdXQoJHNjb3BlLiRkaWdlc3QpO1xufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsZWFybicsIHtcbiAgICAgICAgdXJsOiAnL2xlYXJuJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICcvanMvbGVhcm4vbGVhcm4uaHRtbCcsXG4gICAgfSlcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcbiAgICAgICAgdXJsOiAnL2xvZ2luJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9sb2dpbi5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlLCAkcm9vdFNjb3BlLCAkd2luZG93KSB7XG5cbiAgICAkc2NvcGUubG9naW4gPSB7fTtcbiAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgJHNjb3BlLmdvQmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJHdpbmRvdy5oaXN0b3J5LmJhY2soKTtcbiAgICB9XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKFwic2V0dGluZyBndWVzdCBtb2RlIHRvIGZhbHNlIFwiKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuZ3Vlc3RNb2RlID0gZmFsc2U7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLic7XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lJywge1xuICAgICAgICB1cmw6ICcvbWUnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJy9qcy9teS1zdHVmZi9teS1zdHVmZi5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ215U3R1ZmYnLFxuICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGRhdGEuYXV0aGVudGljYXRlIGlzIHJlYWQgYnkgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgLy8gdGhhdCBjb250cm9scyBhY2Nlc3MgdG8gdGhpcyBzdGF0ZS4gUmVmZXIgdG8gYXBwLmpzLlxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICAgICAgdXNlcjogZnVuY3Rpb24gKFN0b3JlLCBBdXRoU2VydmljZSkge1xuICAgICAgICAgICAgICAgIGlmKFN0b3JlLnVzZXIpIHJldHVybiBTdG9yZS51c2VyO1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgICAgICAgICAudGhlbih1c2VyID0+IHVzZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignbXlTdHVmZicsIGZ1bmN0aW9uICgkc2NvcGUsIHVzZXIpIHtcbiAgICBjb25zb2xlLmxvZyhcIiMjIyMjXCIgLCB1c2VyKTtcbiAgICAkc2NvcGUuYXJjaGl2ZSA9IHVzZXIuYXJjaGl2ZS5zbGljZSgpLnJldmVyc2UoKTtcbn0pO1xuXG5hcHAuZmFjdG9yeSgnU2VjcmV0U3Rhc2gnLCBmdW5jdGlvbiAoJGh0dHApIHtcblxuICAgIHZhciBnZXRTdGFzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9tZW1iZXJzL3NlY3JldC1zdGFzaCcpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGdldFN0YXNoOiBnZXRTdGFzaFxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0Z1bGxzdGFja1BpY3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CN2dCWHVsQ0FBQVhRY0UuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vZmJjZG4tc3Bob3Rvcy1jLWEuYWthbWFpaGQubmV0L2hwaG90b3MtYWsteGFwMS90MzEuMC04LzEwODYyNDUxXzEwMjA1NjIyOTkwMzU5MjQxXzgwMjcxNjg4NDMzMTI4NDExMzdfby5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItTEtVc2hJZ0FFeTlTSy5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3OS1YN29DTUFBa3c3eS5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItVWo5Q09JSUFJRkFoMC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I2eUl5RmlDRUFBcWwxMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFLVQ3NWxXQUFBbXFxSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFdlpBZy1WQUFBazkzMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFZ05NZU9YSUFJZkRoSy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFUXlJRE5XZ0FBdTYwQi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NDRjNUNVFXOEFFMmxHSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBZVZ3NVNXb0FBQUxzai5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBYUpJUDdVa0FBbElHcy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBUU93OWxXRUFBWTlGbC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItT1FiVnJDTUFBTndJTS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I5Yl9lcndDWUFBd1JjSi5wbmc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I1UFRkdm5DY0FFQWw0eC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I0cXdDMGlDWUFBbFBHaC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0IyYjMzdlJJVUFBOW8xRC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0J3cEl3cjFJVUFBdk8yXy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0JzU3NlQU5DWUFFT2hMdy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NKNHZMZnVVd0FBZGE0TC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJN3d6akVWRUFBT1BwUy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJZEh2VDJVc0FBbm5IVi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NHQ2lQX1lXWUFBbzc1Vi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJUzRKUElXSUFJMzdxdS5qcGc6bGFyZ2UnXG4gICAgXTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1Byb2ZpbGVVcGRhdGVyJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlKSB7XG5cbiAgLy93cnBwZXIgZm9yICRodHRwIHRoYXQgYXV0b21hdHVjYWxseSBicm9hZGNhc3RzIGFuIGV2ZW50IChzbyB3ZSBkb24ndCBoYXZlIHRvIGtlZXAgY2FsbGluZyBpdC4gU2x5IGFuZCBEUlkpXG4gIGxldCBodHRwID0gZnVuY3Rpb24gKG1ldGhvZCwgdXJsLCBib2R5KSB7XG5cbiAgICBpZigkcm9vdFNjb3BlLmd1ZXN0TW9kZSkge1xuICAgICAgY29uc29sZS5pbmZvKFwiR3Vlc3QgbW9kZSBpcyBhY3RpdmUuIFVzaW5nIGxvY2FsIHN0b3JhZ2VcIilcbiAgICAgIHJldHVybiBsb2NhbEFjdGlvbigobWV0aG9kICsgdXJsKSwgYm9keSk7XG4gICAgfVxuXG4gICAgcmV0dXJuICRodHRwW21ldGhvZC50b0xvd2VyQ2FzZSgpXSh1cmwsIGJvZHkpXG4gICAgICAudGhlbihyZXMgPT4gJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIHJlcy5kYXRhKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gJHJvb3RTY29wZS4kYnJvYWRjYXN0KCd1cGRhdGUtY29udHJvbGxlcicsIGVyci5kYXRhLCB0cnVlKSlcbiAgfTtcbiAgbGV0IGxvY2FsQWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbiwgcGF5bG9hZCkge1xuICAgIGNvbnNvbGUubG9nKFwiZ2V0dGluZyBhIHByb2ZpbGUgZnJvbSBsb2NhbCBzdG9yYWdlXCIpXG4gICAgbGV0IHByb2ZpbGUgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdwcm9maWxlJykpO1xuICAgIGNvbnNvbGUubG9nKFwidGhlIHByb2ZpbGUgd2UgZ290XCIsIHByb2ZpbGUpXG4gICAgc3dpdGNoIChhY3Rpb24pe1xuICAgICAgY2FzZSAnUFVUL2FwaS91c2VyL3RvbWF0b01ldGVyJzpcbiAgICAgICAgcHJvZmlsZS50b21hdG9NZXRlci5wdXNoKHBheWxvYWQudG9tYXRvKTtcbiAgICAgICAgaWYocGF5bG9hZC50b21hdG8uY2xhc3MgPT09ICdjb21wbGV0ZScpIHByb2ZpbGUudG9tc1RvZGF5Kys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnUE9TVC9hcGkvdXNlci90b21hdG9NZXRlci9hcmNoaXZlJzpcbiAgICAgICAgcHJvZmlsZS5hcmNoaXZlLnB1c2goe1xuICAgICAgICAgIGRhdGU6IFNkLmNvbnZlcnRTZChwcm9maWxlLnN1bkRpYWwpLFxuICAgICAgICAgIHRvbWF0b01ldGVyOiBwcm9maWxlLnRvbWF0b01ldGVyXG4gICAgICAgIH0pO1xuICAgICAgICBwcm9maWxlLnRvbWF0b01ldGVyID0gW107XG4gICAgICAgIHByb2ZpbGUudG9tc1RvZGF5ID0gMDtcbiAgICAgICAgcHJvZmlsZS5zdW5EaWFsID0gU2QoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKFwidGhlIG5ldyBwcm9maWxlXCIsIHByb2ZpbGUpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdwcm9maWxlJywgSlNPTi5zdHJpbmdpZnkocHJvZmlsZSkpO1xuICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgndXBkYXRlLWNvbnRyb2xsZXInLCBwcm9maWxlKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcHVzaFRvbWF0b01ldGVyOiBmdW5jdGlvbiAodG9tYXRvKSB7XG4gICAgICAvLyBzdHVmZiBnb2VzIGhlcmVcbiAgICAgIGNvbnNvbGUubG9nKFwid2hhdCBpcyB0aGUgc2Vzc2lvbiBhbnl3aG8gPz9cIiwgU2Vzc2lvbik7XG4gICAgICByZXR1cm4gaHR0cCgnUFVUJywgJy9hcGkvdXNlci90b21hdG9NZXRlcicsIHtcbiAgICAgICAgdXNlcjogU2Vzc2lvbi51c2VyICYmIFNlc3Npb24udXNlci5faWQsIC8vVE9ETzogcmVtb3ZlIGFuZCB1c2UgdGhlIHVzZXIgb24gdGhlIHJlcS5ib2R5IGZyb20gYmFja2VuZFxuICAgICAgICB0b21hdG8sXG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZVRvbWF0b01ldGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBkZWxldGVzIHRoZSBjdXJyZW50IHRvbWF0byBtZXRlciBvZiB0aGUgZGF5LlxuICAgICAgcmV0dXJuIGh0dHAoJ0RFTEVURScsICcvYXBpL3VzZXIvdG9tYXRvTWV0ZXI/dXNlcj0nICsgU2Vzc2lvbi51c2VyLl9pZCk7XG4gICAgICByZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL3VzZXIvdG9tYXRvTWV0ZXI/dXNlcj0nICsgU2Vzc2lvbi51c2VyLl9pZCk7XG4gICAgfSxcbiAgICBhcmNoaXZlVG9tYXRvTWV0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGFsZXJ0KFwiaGl0IHRoZSB0b21hdG8gbWV0ZXJcIilcbiAgICAgIHJldHVybiBodHRwKCdQT1NUJywgJy9hcGkvdXNlci90b21hdG9NZXRlci9hcmNoaXZlJyk7XG4gICAgfSxcbiAgfVxufSk7XG4iLCJhcHAuZmFjdG9yeSgnUmFuZG9tR3JlZXRpbmdzJywgZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGdldFJhbmRvbUZyb21BcnJheSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XG4gICAgfTtcblxuICAgIHZhciBncmVldGluZ3MgPSBbXG4gICAgICAgICdIZWxsbywgd29ybGQhJyxcbiAgICAgICAgJ0F0IGxvbmcgbGFzdCwgSSBsaXZlIScsXG4gICAgICAgICdIZWxsbywgc2ltcGxlIGh1bWFuLicsXG4gICAgICAgICdXaGF0IGEgYmVhdXRpZnVsIGRheSEnLFxuICAgICAgICAnSVxcJ20gbGlrZSBhbnkgb3RoZXIgcHJvamVjdCwgZXhjZXB0IHRoYXQgSSBhbSB5b3Vycy4gOiknLFxuICAgICAgICAnVGhpcyBlbXB0eSBzdHJpbmcgaXMgZm9yIExpbmRzYXkgTGV2aW5lLicsXG4gICAgICAgICfjgZPjgpPjgavjgaHjga/jgIHjg6bjg7zjgrbjg7zmp5jjgIInLFxuICAgICAgICAnV2VsY29tZS4gVG8uIFdFQlNJVEUuJyxcbiAgICAgICAgJzpEJyxcbiAgICAgICAgJ1llcywgSSB0aGluayB3ZVxcJ3ZlIG1ldCBiZWZvcmUuJyxcbiAgICAgICAgJ0dpbW1lIDMgbWlucy4uLiBJIGp1c3QgZ3JhYmJlZCB0aGlzIHJlYWxseSBkb3BlIGZyaXR0YXRhJyxcbiAgICAgICAgJ0lmIENvb3BlciBjb3VsZCBvZmZlciBvbmx5IG9uZSBwaWVjZSBvZiBhZHZpY2UsIGl0IHdvdWxkIGJlIHRvIG5ldlNRVUlSUkVMIScsXG4gICAgXTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGdyZWV0aW5nczogZ3JlZXRpbmdzLFxuICAgICAgICBnZXRSYW5kb21HcmVldGluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFJhbmRvbUZyb21BcnJheShncmVldGluZ3MpO1xuICAgICAgICB9XG4gICAgfTtcblxufSk7XG4iLCJhcHAuZmFjdG9yeSgnU3RvcmUnLCBmdW5jdGlvbiAoJGxvZykge1xuXG4gICAgLy9UT0RPOiBvbmNlIHVzZXJzIGlzIGltcGxpbWVudGVkLCB0aGUgYmVsb3cgZGVmYXVsdFN0b3JlIHdpbGwgb25seSBiZSByZXR1cmVkIGlmIHVzZXIgaXMgbm90IGxvZ2dlZCBpblxuICAgIC8vIHRoaXMgaXMgdGhlIHN0YXJ0bmcgdXNlciBzdGF0ZSBhbmQgd2lsbCBiZSBtb2RpZmVkIGZvciBhcyBsb25nIGFzIHNlc3Npb24gaXMgYWN0aXZlLiBXaGVuIGEgdXNlciBzaWducyB1cCxcbiAgICAvLyBhbnkgcHJvZ3Jlc3MgZnJvbSBoZXJlIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSB1c2VyIGNyZWF0aW9uLlxuXG4gICAgbGV0IFN0b3JlID0ge1xuICAgICAgICAvL1RPRE8gbmVlZCB0byBmaW5kIGEgYmV0dGVyIHdheSB0byB1cGRhdGUgdGhlIHN0b3JlXG4gICAgICAgIG5ld1JlczogbnVsbCxcbiAgICAgICAgdXNlcjogbnVsbCxcbiAgICAgICAgcHJvZmlsZToge1xuICAgICAgICAgICAgYXJjaGl2ZTogW10sXG4gICAgICAgICAgICB0b21zRWF0ZW46IHtcbiAgICAgICAgICAgICAgICB0b2RheTogMCxcbiAgICAgICAgICAgICAgICB0b21hdG9NZXRlcjogW10sXG4gICAgICAgICAgICAgICAgYXJjaGl2ZTogW1xuICAgICAgICAgICAgICAgICAgICAvL1RPRE86IFJFTU9WRSBvbiA4LzI1XG4gICAgICAgICAgICAgICAgICAgIC8ve2RhdGU6IERhdGUsIHRvdGFsOiAwLCB0b21hdG9NZXRlcjogezx0b21hdG9NZXRlcj59IH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGdldFRvdGFsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi5hcmNoaXZlLm1hcCh0ID0+IHQudG90YWwpLnJlZHVjZSgocCwgbikgPT4gcCArIG4sIFN0b3JlLnByb2ZpbGUudG9tc1RvZGF5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHVubG9ja2VkRmVhdHVyZXM6IFtdLFxuICAgICAgICBmZWF0dXJlczogW1xuICAgICAgICAgICAge25hbWU6IFwiZ29hbFNldHRlclwiLCB1bmxvY2tBdDogMSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJ0b2RvXCIsIHVubG9ja0F0OiAzLCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcIm1hcmtGYWlsXCIsIHVubG9ja0F0OiB7ZGF5c0NvbXBsZXRlOiAyfSwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgICAgICB7bmFtZTogXCJzbmFrZVwiLCB1bmxvY2tBdDogOCwgdHlwZTogXCJnYW1lXCIsIGxpc3RlbmVyOiBcInRvbUNvbXBsZXRlXCJ9LFxuICAgICAgICAgICAge25hbWU6IFwicGxheWxpc3RcIiwgdW5sb2NrQXQ6IHt0b21zVG9kYXk6IDh9LCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcImdvYWxTZXR0b3JcIiwgdW5sb2NrQXQ6IHtzdHJlYWs6IDN9LCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtuYW1lOiBcInRldHJpc1wiLCB1bmxvY2tBdDogNDQsIHR5cGU6IFwiZ2FtZVwiLCBsaXN0ZW5lcjogXCJ0b21Db21wbGV0ZVwifSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImRhcmtUaGVtZVwiLFxuICAgICAgICAgICAgICAgIHVubG9ja0F0OiB7ZGF5c0NvbXBsZXRlOiAzMH0sXG4gICAgICAgICAgICAgICAgdW5sb2NrRm46ICgpID0+IChuZXcgRGF0ZSgpKS5nZXRIb3VycygpID4gMTgsXG4gICAgICAgICAgICAgICAgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtuYW1lOiBcIjEwMDB0b21zUGFnZVwiLCB1bmxvY2tBdDogMTAwMCwgbGlzdGVuZXI6IFwidG9tQ29tcGxldGVcIn0sXG4gICAgICAgIF0sXG4gICAgICAgIGdldFRvdGFsVG9tczogKHVzZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBfLnN1bSh1c2VyLmFyY2hpdmUubWFwKGkgPT4gaS50b21hdG9NZXRlci5maWx0ZXIodCA9PiB0LmNsYXNzID09PSAnY29tcGxldGUnKS5sZW5ndGgpKSArICh1c2VyLnRvbXNUb2RheSB8fCAwKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibWV0ZXI/Pz8gXCIsIGFyY2hpdmVUb3RhbHMpXG4gICAgICAgICAgICByZXR1cm4gdXNlci5hcmNoaXZlLnJlZHVjZSgocCwgdG9tYXRvU2VyaWVzKSA9PiB0b21hdG9TZXJpZXMudG9tYXRvTW90ZXIucmVkdWNlKChwLCB0KSA9PiAodC5jbGFzcyA9PT0gJ2NvbXBsZXRlJyA/IDE6MCkgKyBwLDApXG4gICAgICAgICAgICAgICAgKyBwLDApXG4gICAgICAgICAgICAgICAgKyB1c2VyLnRvbXNUb2RheSB8fCAwO1xuICAgICAgICB9LFxuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChuZXdQcm9wcykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgLy8gbW92ZSB0aGlzIHNvbWV3aGVyZSBlbHNlXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpXG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRodHRwLnB1dCgnL2FwaS91c2VyLycsIHtuZXdQcm9wczogbmV3UHJvcHMsIHVzZXI6IHJlcy5kYXRhLnVzZXJ9KVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4odXNlciA9PiBjb25zb2xlLmxvZyhcIm5ldyB1c2VyIGRhdGFcIiwgdXNlcikpXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUuZXJyb3IoXCJzb21ldGhpbmcgd2VudCB3cm9uZ1wiLCBlcnJvcikpO1xuICAgICAgICB9LFxuICAgICAgICBhcmNoaXZlVG9tc0VhdGVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIVN0b3JlLnByb2ZpbGUudG9tc1RvZGF5KSB7XG4gICAgICAgICAgICAgICAgJGxvZy5pbmZvKFwibm90aGluZyB0byBhcmNoaXZlLiBVc2VyIG5vdCB1cGRhdGVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCB0b21JbmZvID0ge1xuICAgICAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgdG90YWw6IFN0b3JlLnByb2ZpbGUudG9tc1RvZGF5LFxuICAgICAgICAgICAgICAgIHRvbWF0b01ldGVyOiBTdG9yZS5wcm9maWxlLnRvbXNFYXRlbi50b21hdG9NZXRlci5maWx0ZXIodCA9PiB0LnRleHQgIT09IFwiLi4uXCIpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFN0b3JlLnByb2ZpbGUudG9tc0VhdGVuLnRvbWF0b01ldGVyID0gW107XG4gICAgICAgICAgICBsZXQgbmV3QXJjaGl2ZSA9IFt0b21JbmZvXS5jb25jYXQoU3RvcmUucHJvZmlsZS50b21zRWF0ZW4uYXJjaGl2ZSk7XG4gICAgICAgICAgICByZXR1cm4gU3RvcmUudXBkYXRlUHJvZmlsZSh7dG9tc0VhdGVuOiB7YXJjaGl2ZTogbmV3QXJjaGl2ZX19KTtcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gYXR0YWNoIHVzZXIgdG8gdGhlIHN0b3JlXG5cbiAgICByZXR1cm4gU3RvcmU7XG5cbn0pO1xuXG4vKlxuIHVubG9ja0F0OlxuIE51bWJlciAtIGFtb3VudCBvZiB0b3RhbCB0b21zIGVhdGVuXG4gT2JqIC0gZGlmZmVyZW50IHByb3AgdG8gdW5sb2NrIGF0OlxuIHRvbXNDb21wbGV0ZSAoZGVmdWFsdCkgLSB0b3RhbCB0b21zIGVhdGVuLiBTYW1lIGFzIHBhc3NpbmcgbnVtYmVyXG4gdG9tc1RvZGF5IC0gbnVtYmVyIGluIGEgZGF5LlxuIGRheXNDb21wbGV0ZTogbnVtYmVyIG9mIGRheXMgYSB0b20gd2FzIGVhdGVuOiBPUiBvYmpcbiBzdHJlYWs6IG51bWJlciBkYXlzIGluIGEgcm93IHRoYXQgYSB0b20gd2FzIGVhdGVuLlxuXG4gRmVhdHVyZSBsaXN0ZW5lcnM6XG4gXCJ0b21Db21wbGV0ZVwiIDogd2hlbiBhIHBvbW9kb3JvIGlzIHN1Y2Vzc2Z1bGx5IGNvbXBsZXRlLlxuIFwibmV3RGF5XCIgOiB3aGVuIHRoZSBhcHAgaXMgb3BlbmVkIG9uIGEgbmV3IGRheS5cbiAqL1xuIiwiYXBwLmRpcmVjdGl2ZSgnZnVsbHN0YWNrTG9nbycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmh0bWwnXG4gICAgfTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSwgJHdpbmRvdykge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnUG9tb2Rvcm8nLCBzdGF0ZTogJ2hvbWUnIH0sXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ015IFN0dWZmJywgc3RhdGU6ICdtZScsIGF1dGg6IHRydWV9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdMZWFybicsIHN0YXRlOiAnbGVhcm4nfSxcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnQWJvdXQgLyBTdXBwb3J0Jywgc3RhdGU6ICdhYm91dCcgfSxcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBzY29wZS5zdGF0ZSA9ICRzdGF0ZTtcblxuICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHNjb3BlLmlzTG9nZ2VkSW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmxvZ291dCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHNldFVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciByZW1vdmVVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNldFVzZXIoKTtcblxuICAgICAgICAgICAgc2NvcGUuZ29CYWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICR3aW5kb3cuaGlzdG9yeS5iYWNrKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldFVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9nb3V0U3VjY2VzcywgcmVtb3ZlVXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgcmVtb3ZlVXNlcik7XG5cbiAgICAgICAgICAgIHZhciAkZHJvcGRvd24gPSAkKFwiLm5hdmJhci1uYXYtbW9iaWxlLWRyb3Bkb3duXCIpO1xuXG4gICAgICAgICAgICBzY29wZS50b2dnbGVNb2JpbGVEcm9wZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZigkc3RhdGUuY3VycmVudC5uYW1lID09PSAnbG9naW4nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgJGRyb3Bkb3duLnRvZ2dsZUNsYXNzKCdvcGVuZWQnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgY2xvc2VEcm9wZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkZHJvcGRvd24ucmVtb3ZlQ2xhc3MoJ29wZW5lZCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGNsb3NlRHJvcGRvd24pO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN1Y2Nlc3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgJCgnI21haW4nKS5vbignY2xpY2snLCBjbG9zZURyb3Bkb3duKTtcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdyYW5kb0dyZWV0aW5nJywgZnVuY3Rpb24gKFJhbmRvbUdyZWV0aW5ncykge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9yYW5kby1ncmVldGluZy9yYW5kby1ncmVldGluZy5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgICAgICAgICBzY29wZS5ncmVldGluZyA9IFJhbmRvbUdyZWV0aW5ncy5nZXRSYW5kb21HcmVldGluZygpO1xuICAgICAgICB9XG4gICAgfTtcblxufSk7IiwiYXBwLmRpcmVjdGl2ZSgnc3BsYXNoU2NyZWVuJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlOiAnPGRpdiBpZD1cInNwbGFzaC1zY3JlZW5cIj48ZGl2IGlkPVwibG9hZGluZy1jb250ZW50XCI+e3tsb2FkaW5nVGV4dH19PC9kaXY+PC9kaXY+JyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGUpIHtcblxuICAgICAgICAgICAgc2NvcGUubG9hZGluZ1RleHQgPSBcIkxvYWRpbmdcIjtcbiAgICAgICAgICAgIHZhciBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgYXBwZW5kID0gc2NvcGUubG9hZGluZ1RleHQgKyBcIiAuXCI7XG4gICAgICAgICAgICAgICAgaWYoYXBwZW5kLmxlbmd0aCA+IDE0KSBhcHBlbmQgPSBcIkxvYWRpbmdcIjtcbiAgICAgICAgICAgICAgICBzY29wZS5sb2FkaW5nVGV4dCA9IGFwcGVuZDtcbiAgICAgICAgICAgICAgICBzY29wZS4kZGlnZXN0KCk7XG4gICAgICAgICAgICB9LCA0MDApO1xuXG4gICAgICAgICAgICB2YXIgc3BsYXNoVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYoIXdpbmRvdy5yZWFkeSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSB3aW5kb3cucmVhZHk7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChzcGxhc2hUaW1lcik7XG4gICAgICAgICAgICAgICAgZWxlLnJlbW92ZSgpO1xuICAgICAgICAgICAgfSwyMDAwICsgKE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDUwMCkpKTtcblxuICAgICAgICB9XG4gICAgfVxufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
